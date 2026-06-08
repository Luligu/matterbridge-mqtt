/**
 * This file contains the MqttService class that wraps the mqtt client for use by MqttPlatform.
 *
 * @file mqtt.ts
 * @author Luca Liguori
 * @created 2026-05-14
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';

import { AnsiLogger, debugStringify, LogLevel, sc, TimestampFormat, error, debug, warn, info } from 'matterbridge/logger';
import { inspectError } from 'matterbridge/utils';
import { connectAsync, type IClientOptions, type IClientPublishOptions, type MqttClient } from 'mqtt';

import type { MqttPlatformConfig } from './module.js';

/**
 * Typed EventEmitter interface for {@link MqttService} events.
 *
 * Consumers use the standard `.on()` / `.once()` / `.off()` API:
 *
 * ```ts
 * mqttService.on('connect', () => { ... });
 * mqttService.on('message', (topic, payload) => { ... });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional declaration merge for typed EventEmitter overloads
export interface MqttService {
  /** Emitted once the broker acknowledges the initial connection, when the connection closes, or when a reconnect attempt begins. */
  on(event: 'connect' | 'close' | 'reconnect', listener: () => void): this;
  /** Emitted when the client encounters a protocol or transport error. */
  on(event: 'error', listener: (error: Error) => void): this;
  /** Emitted for each MQTT message received on a subscribed topic, or after a successful publish. */
  on(event: 'message' | 'published', listener: (topic: string, payload: string) => void): this;
  /** Emitted after a topic has been successfully subscribed. */
  on(event: 'subscribed', listener: (topic: string) => void): this;

  /** @internal */
  emit(event: 'connect' | 'close' | 'reconnect'): boolean;
  /** @internal */
  emit(event: 'error', error: Error): boolean;
  /** @internal */
  emit(event: 'message' | 'published', topic: string, payload: string): boolean;
  /** @internal */
  emit(event: 'subscribed', topic: string): boolean;
}

/**
 * Manages a single MQTT connection for the MqttPlatform.
 *
 * The service reads TLS assets and credentials from the platform configuration,
 * builds an `IClientOptions` object, and delegates to the `mqtt` library.
 *
 * Emitted events: `connect`, `close`, `reconnect`, `error`, `message`, `subscribed`, `published`.
 */
export class MqttService extends EventEmitter {
  private readonly config: MqttPlatformConfig;
  private readonly log = new AnsiLogger({
    logName: 'MQTT',
    logNameColor: sc,
    logTimestampFormat: TimestampFormat.TIME_MILLIS,
    logLevel: LogLevel.DEBUG,
  });

  private client: MqttClient | undefined;

  /**
   * Creates an MqttService instance.
   *
   * @param {MqttPlatformConfig} config The platform configuration containing broker connection details.
   */
  constructor(config: MqttPlatformConfig) {
    super();
    this.config = config;
  }

  /**
   * Builds an `IClientOptions` object from the platform configuration.
   *
   * Edge cases:
   *  - `clientId`, `username`, `password` are omitted when empty so the broker falls back to its defaults.
   *  - `ca`, `cert`, `key` are read from disk only when the config value is a non-empty string.
   *    Throws with a descriptive message when the file cannot be read.
   *
   * @returns {IClientOptions} Options object suitable for `mqtt.connect()`.
   * @throws {Error} When a configured TLS file path cannot be read from disk.
   */
  private buildClientOptions(): IClientOptions {
    const options: IClientOptions = {
      port: this.config.port,
      protocolVersion: this.config.protocolVersion,
      rejectUnauthorized: this.config.rejectUnauthorized,
    };

    if (this.config.clientId) options.clientId = this.config.clientId;
    if (this.config.username) options.username = this.config.username;
    if (this.config.password) options.password = this.config.password;

    if (this.config.ca) {
      try {
        options.ca = readFileSync(this.config.ca);
      } catch (error) {
        throw new Error(`MqttService: failed to read CA certificate '${this.config.ca}': ${error?.toString()}`, { cause: error });
      }
    }
    if (this.config.cert) {
      try {
        options.cert = readFileSync(this.config.cert);
      } catch (error) {
        throw new Error(`MqttService: failed to read client certificate '${this.config.cert}': ${error?.toString()}`, { cause: error });
      }
    }
    if (this.config.key) {
      try {
        options.key = readFileSync(this.config.key);
      } catch (error) {
        throw new Error(`MqttService: failed to read client private key '${this.config.key}': ${error?.toString()}`, { cause: error });
      }
    }

    return options;
  }

  /**
   * Connects to the MQTT broker using the platform configuration.
   *
   * If the client is already connected the call is a no-op. Internal MQTT client events are
   * mapped to EventEmitter events on this instance (`connect`, `close`, `reconnect`, `error`,
   * `message`). Resolves once the broker acknowledges the initial connection.
   *
   * @returns {Promise<boolean>} Resolves to `true` when connected, `false` if the connection fails.
   */
  async connect(): Promise<boolean> {
    if (this.client?.connected) {
      this.log.debug('MqttService: already connected, ignoring connect()');
      return true;
    }

    const options = this.buildClientOptions();
    const brokerUrl = `${this.config.host}:${this.config.port}`;

    this.log.debug(
      `MqttService: connecting to ${debug.bold.success`${brokerUrl}`} with options: ${debugStringify({ ...options, password: options.password ? '****' : undefined, ca: options.ca ? '****' : undefined, cert: options.cert ? '****' : undefined, key: options.key ? '****' : undefined })}`,
    );

    let client: MqttClient;
    try {
      client = await connectAsync(this.config.host, options);
    } catch (err) {
      inspectError(this.log, `MqttService: failed to connect to ${error.bold.success`${brokerUrl}`}`, err);
      return false;
    }
    this.client = client;

    this.log.info(`MqttService: connected to ${info.bold.success`${brokerUrl}`}`);
    this.emit('connect');

    client.on('connect', () => {
      this.log.info(`MqttService: connected to ${info.bold.success`${brokerUrl}`}`);
      this.emit('connect');
    });

    client.on('close', () => {
      this.log.info(`MqttService: connection to ${info.bold.success`${brokerUrl}`} closed`);
      this.emit('close');
    });

    client.on('reconnect', () => {
      this.log.debug(`MqttService: reconnecting to ${debug.bold.success`${brokerUrl}`}`);
      this.emit('reconnect');
    });

    client.on('error', (err) => {
      inspectError(this.log, `MqttService: error on ${error.bold.success`${brokerUrl}`}`, err);
      this.emit('error', err);
    });

    client.on('message', (topic, payload) => {
      this.log.debug(`MqttService: message on ${debug.bold.success`${topic}`}: "${payload.toString().replaceAll('\n', '')}"`);
      this.emit('message', topic, payload.toString());
    });
    return true;
  }

  /**
   * Gracefully closes the MQTT connection and disposes the underlying client.
   *
   * Resolves once the connection has been cleanly ended. Safe to call when not connected.
   *
   * @returns {Promise<boolean>} Resolves to `true` when closed successfully, `false` if `endAsync` fails.
   */
  async close(): Promise<boolean> {
    if (!this.client) {
      return true;
    }
    try {
      await this.client.endAsync();
    } catch (err) {
      inspectError(this.log, `MqttService: error closing connection to ${error.bold.success`${this.config.host}:${this.config.port}`}`, err);
      return false;
    }
    this.client = undefined;
    this.log.debug('MqttService: client closed');
    return true;
  }

  /**
   * Subscribes to an MQTT topic.
   *
   * Edge cases:
   *  - Logs a warning and returns early when the client is not connected.
   *  - Subscribe errors are caught and logged; the returned Promise always resolves.
   *
   * @param {string} topic MQTT topic string, may include wildcards (`+`, `#`).
   * @returns {Promise<boolean>} Resolves to `true` after subscribing, `false` if not connected or the subscribe call fails.
   */
  async subscribe(topic: string): Promise<boolean> {
    if (!this.client?.connected) {
      this.log.warn(`MqttService: cannot subscribe to '${warn.bold.success`${topic}`}': not connected`);
      return false;
    }

    try {
      await this.client.subscribeAsync(topic);
      this.log.debug(`MqttService: subscribed to '${debug.bold.success`${topic}`}'`);
      this.emit('subscribed', topic);
      return true;
    } catch (err) {
      inspectError(this.log, `MqttService: subscribe error on '${error.bold.success`${topic}`}'`, err);
      return false;
    }
  }

  /**
   * Publishes a message to an MQTT topic.
   *
   * Edge cases:
   *  - Logs a warning and returns early when the client is not connected.
   *  - Publish errors are caught and logged; the returned Promise always resolves.
   *
   * @param {string} topic MQTT topic to publish to.
   * @param {string} payload Message payload as a UTF-8 string.
   * @param {IClientPublishOptions} [options] Optional publish options (QoS, retain, …).
   * @returns {Promise<boolean>} Resolves to `true` after publishing, `false` if not connected or the publish call fails.
   */
  async publish(topic: string, payload: string, options?: IClientPublishOptions): Promise<boolean> {
    if (!this.client?.connected) {
      this.log.warn(`MqttService: cannot publish to '${warn.bold.success`${topic}`}': not connected`);
      return false;
    }

    try {
      await this.client.publishAsync(topic, payload, options);
      this.log.debug(`MqttService: published to '${debug.bold.success`${topic}`}': ${debug.bold.success`${payload}`}`);
      this.emit('published', topic, payload);
      return true;
    } catch (err) {
      inspectError(this.log, `MqttService: publish error on '${error.bold.success`${topic}`}'`, err);
      return false;
    }
  }
}
