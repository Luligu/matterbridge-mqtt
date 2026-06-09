/**
 * This file contains the MqttPlatform plugin entry point, platform configuration interface, and the MqttPlatform class.
 *
 * @file module.ts
 * @author Luca Liguori
 * @created 2025-11-13
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026 Luca Liguori.
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

import {
  bridgedNode,
  type DeviceTypeDefinition,
  getBehaviourTypeFromClusterServerId,
  getSupportedCluster,
  getSupportedDeviceType,
  MatterbridgeDynamicPlatform,
  MatterbridgeEndpoint,
  type PlatformConfig,
  type PlatformMatterbridge,
} from 'matterbridge';
import { type AnsiLogger, debugStringify, info, warn } from 'matterbridge/logger';
import type { AtLeastOne } from 'matterbridge/matter';
import type { BridgedDeviceBasicInformation, PowerSource } from 'matterbridge/matter/clusters';
import { fireAndForget, inspectError } from 'matterbridge/utils';
import type { IPublishPacket } from 'mqtt';

import { MqttService } from './mqtt.js';

export interface MqttPlatformConfig extends PlatformConfig {
  host: string;
  port: number;
  protocolVersion: 3 | 4 | 5;
  username: string;
  password: string;
  clientId: string;
  ca: string;
  rejectUnauthorized: boolean;
  cert: string;
  key: string;
  topic: string;
  whiteList: string[];
  blackList: string[];
}

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
 * @param {MqttPlatformConfig} config - The MQTT platform configuration.
 * @returns {MqttPlatform} - An instance of the MQTT Platform. This is the main interface for interacting with the MQTT system.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: MqttPlatformConfig): MqttPlatform {
  return new MqttPlatform(matterbridge, log, config);
}

export class MqttPlatform extends MatterbridgeDynamicPlatform {
  /** The MQTT service instance */
  private mqtt: MqttService;
  /** Maintains the state of each device: key = topic, value = payload */
  state: Map<string, string> = new Map();

  /**
   * Initializes the MQTT platform plugin.
   *
   * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
   * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
   * @param {MqttPlatformConfig} config - The MQTT platform configuration.
   * @throws {Error} If the Matterbridge version is not compatible with this plugin.
   */
  constructor(
    matterbridge: PlatformMatterbridge,
    log: AnsiLogger,
    override config: MqttPlatformConfig,
  ) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.8.1')) {
      throw new Error(`This plugin requires Matterbridge version >= "3.8.1". Please update Matterbridge to the latest version in the frontend.`);
    }

    this.log.info(`Initializing platform: ${this.config.name}`);

    this.mqtt = new MqttService(this.config);

    this.log.info(`Finished initializing platform: ${this.config.name}`);
  }

  override async onStart(reason?: string): Promise<void> {
    this.log.info(`onStart called with reason: ${reason}`);

    // Clear the select since we will be re-populating it based on the MQTT messages we receive, and we want to avoid any stale entries from previous runs
    await this.ready;
    await this.clearSelect();

    this.mqtt.on('connect', () => {
      this.log.info('MQTT connected');
      void this.mqtt.subscribe(`${this.config.topic}/#`);
    });

    this.mqtt.on('subscribed', (topic: string) => {
      this.log.info(`MQTT subscribed to topic: ${topic}`);
    });

    this.mqtt.on('published', (topic: string, payload: string) => {
      this.log.info(`MQTT published to topic: ${topic} with payload: ${payload}`);
    });

    this.mqtt.on('close', () => {
      this.log.info('MQTT connection closed');
    });

    this.mqtt.on('reconnect', () => {
      this.log.debug('MQTT reconnecting');
    });

    this.mqtt.on('error', (error) => {
      this.log.error(`MQTT error: ${error.message}`);
    });

    this.mqtt.on('message', (topic, payload, packet) => {
      this.mqttMessageHandler(topic, payload, packet);
    });

    await this.mqtt.connect();
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.info('onConfigure called');
    for (const [topic, payload] of this.state.entries()) {
      await this.updateHandler(topic, payload);
    }
  }

  override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    this.log.info(`onShutdown called with reason: ${reason}`);
    await this.mqtt.close();
    if (this.config.unregisterOnShutdown) await this.unregisterAllDevices();
  }

  /**
   * Parses an MQTT topic into its constituent parts.
   *
   * Expected format: `<baseTopic>/<deviceId>/<subTopic>/<endpointName>`
   *
   * Where:
   * - `<baseTopic>` is defined by `this.config.topic` and is not included in the output.
   * - `<deviceId>` is a stable identifier for the device and is used as the endpoint id and as the fallback node label and serial number.
   * - `<subTopic>` indicates the type of message (e.g., `config`, `state`) and determines how the payload will be processed.
   * - `<endpointName>` is an informational name of the endpoint within the device (e.g `root` for the main endpoint).
   *
   * @param {string} topic - The full MQTT topic string to parse.
   * @returns {{ deviceId: string; subTopic: string; endpointName: string } | null} The parsed `deviceId`, `subTopic`, and `endpointName`, or `null` if the topic does not match the expected format.
   */
  mqttTopicParser(topic: string): { deviceId: string; subTopic: string; endpointName: string } | null {
    const regex = new RegExp(`^${this.config.topic}/([^/]+)/([^/]+)/([^/]+)$`);
    const match = topic.match(regex);
    if (!match) {
      return null;
    }
    const [, deviceId, subTopic, endpointName] = match;
    return { deviceId, subTopic, endpointName };
  }

  /**
   * Handles an incoming MQTT message by dispatching it based on its subTopic.
   *
   * Dispatches `config` messages to {@link createDevice} and logs `state` messages.
   * Warns on unrecognized subTopics and on topics that do not match the expected format.
   *
   * @param {string} topic - The MQTT topic on which the message was received.
   * @param {string} payload - The raw JSON string payload of the message.
   * @param {IPublishPacket} packet - The original MQTT publish packet metadata.
   */
  mqttMessageHandler(topic: string, payload: string, packet: IPublishPacket): void {
    try {
      const parsed = this.mqttTopicParser(topic);
      if (!parsed) {
        this.log.warn(`Received MQTT message on topic '${topic}' that does not match expected format. Ignoring.`);
        return;
      }
      const { deviceId, subTopic, endpointName } = parsed;
      if (subTopic === 'config' && payload === '') {
        this.log.debug(`MQTT ${packet.retain ? 'retained ' : ''}message on '${topic}': empty payload`);
        this.log.info(`Received empty payload on config topic '${topic}', treating as device deletion request.`);
        this.destroyDevice(deviceId);
        return;
      }
      if (subTopic === 'state' && payload === '') {
        this.log.debug(`MQTT ${packet.retain ? 'retained ' : ''}message on '${topic}': empty payload`);
        return;
      }
      const message = JSON.parse(payload);
      this.log.debug(`MQTT ${packet.retain ? 'retained ' : ''}message on '${topic}': ${debugStringify(message)}`);
      if (subTopic === 'config') {
        this.log.info(
          `Received ${info.bgMagenta.black.bold` config `} message for device ${info.bgCyan.black.bold` ${deviceId} `} endpoint ${info.bgGreen.black.bold` ${endpointName} `}`,
        );
        if (typeof message.deviceTypes !== 'object' && !Array.isArray(message.deviceTypes)) {
          this.log.warn(`Received MQTT message on topic '${topic}' with invalid format: 'deviceTypes' field is missing or not an array. Ignoring.`);
          return;
        }
        if (typeof message.clusters !== 'object' || Array.isArray(message.clusters)) {
          this.log.warn(`Received MQTT message on topic '${topic}' with invalid format: 'clusters' field is missing or not an object. Ignoring.`);
          return;
        }
        this.createDevice(deviceId, endpointName, message);
      } else if (subTopic === 'state') {
        this.log.info(
          `Received ${info.bgMagenta.black.bold` state `} message for device ${info.bgCyan.black.bold` ${deviceId} `} endpoint ${info.bgGreen.black.bold` ${endpointName} `}`,
        );
        this.state.set(topic, payload);
        if (typeof message !== 'object' || Array.isArray(message)) {
          this.log.warn(`Received MQTT message on topic '${topic}' with invalid format: state is missing or not an object. Ignoring.`);
          return;
        }
        // istanbul ignore else
        if (this.isConfigured) fireAndForget(this.updateHandler(topic, payload), this.log, `Failed to handle state update for device ${deviceId} on endpoint ${endpointName}`);
      } else {
        this.log.warn(`Received MQTT message with unrecognized subTopic ${warn.magenta.bold`${subTopic}`} on topic ${warn.success.bold`${topic}`}. Ignoring.`);
      }
    } catch (error) {
      inspectError(this.log, `Failed to parse MQTT message on '${topic}' with payload ${payload.replaceAll('\n', '')}`, error);
    }
  }

  /**
   * Creates and registers a `MatterbridgeEndpoint` from an MQTT `config` payload.
   *
   * Builds the device type list from `jsonPayload.deviceTypes`, reads identity metadata
   * from `jsonPayload.clusters.BridgedDeviceBasicInformation`, and registers the device
   * asynchronously via {@link registerDevice}.
   *
   * @param {string} deviceId - Stable identifier for the device; used as the endpoint id and as the fallback node label and serial number.
   * @param {string} endpointName - Name of the endpoint within the device (e.g. `root`).
   * @param {{ deviceTypes: string[]; clusters: { [key: string]: { [key: string]: unknown } } }} jsonPayload - Parsed config payload containing `deviceTypes` and `clusters` maps.
   */
  createDevice(deviceId: string, endpointName: string, jsonPayload: { deviceTypes: string[]; clusters: { [key: string]: { [key: string]: unknown } } }): void {
    this.log.debug(`Creating device with ID ${deviceId} and endpoint ${endpointName} based on config: ${debugStringify(jsonPayload)}`);
    const deviceTypes: DeviceTypeDefinition[] = [];
    const bridgedDeviceBasicInformationCluster: Partial<BridgedDeviceBasicInformation.Attributes> = jsonPayload.clusters.BridgedDeviceBasicInformation || {};
    const deviceName = bridgedDeviceBasicInformationCluster.nodeLabel ?? deviceId;
    const serialNumber = bridgedDeviceBasicInformationCluster.serialNumber ?? deviceId;

    /** Validate against the select */
    this.setSelectDevice(serialNumber, deviceName);
    if (!this.validateDevice([serialNumber, deviceName])) return;

    for (const name of jsonPayload.deviceTypes.filter((dt) => dt !== 'BridgedNode')) {
      const found = getSupportedDeviceType(name);
      if (found) {
        deviceTypes.push(found);
      } else {
        this.log.warn(`Device type '${name}' is not supported. Skipping.`);
      }
    }
    /** All devices must include the Bridged Node device type as per spec since we are creating bridged devices, and we add as last */
    deviceTypes.push(bridgedNode);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const device = new MatterbridgeEndpoint(deviceTypes as AtLeastOne<DeviceTypeDefinition>, {
      id: deviceId,
    });

    /** Bridged Device Basic Information Cluster */
    device.createDefaultBridgedDeviceBasicInformationClusterServer(
      deviceName,
      serialNumber,
      bridgedDeviceBasicInformationCluster.vendorId,
      bridgedDeviceBasicInformationCluster.vendorName,
      bridgedDeviceBasicInformationCluster.productName,
      bridgedDeviceBasicInformationCluster.softwareVersion,
      bridgedDeviceBasicInformationCluster.softwareVersionString,
      bridgedDeviceBasicInformationCluster.hardwareVersion,
      bridgedDeviceBasicInformationCluster.hardwareVersionString,
    );
    this.log.debug(`Created Bridged Device Basic Information Cluster for device ${deviceId} with attributes: ${debugStringify(bridgedDeviceBasicInformationCluster)}`);

    /** Power Source Cluster */
    if (jsonPayload.deviceTypes.includes('PowerSource')) {
      const powerSourceCluster: Partial<PowerSource.Attributes> = jsonPayload.clusters.PowerSource || {};
      if (powerSourceCluster.batReplacementDescription !== undefined || powerSourceCluster.batQuantity !== undefined) {
        device.createDefaultPowerSourceReplaceableBatteryClusterServer(
          powerSourceCluster.batPercentRemaining,
          powerSourceCluster.batChargeLevel,
          powerSourceCluster.batVoltage,
          powerSourceCluster.batReplacementDescription,
          powerSourceCluster.batQuantity,
          powerSourceCluster.batReplaceability,
        );
        this.log.debug(`Created Power Source Replaceable Battery Cluster for device ${deviceId} with attributes: ${debugStringify(powerSourceCluster)}`);
      } else if (powerSourceCluster.batChargeState !== undefined || powerSourceCluster.batFunctionalWhileCharging !== undefined) {
        device.createDefaultPowerSourceRechargeableBatteryClusterServer(
          powerSourceCluster.batPercentRemaining,
          powerSourceCluster.batChargeLevel,
          powerSourceCluster.batVoltage,
          powerSourceCluster.batReplaceability,
        );
        this.log.debug(`Created Power Source Rechargeable Battery Cluster for device ${deviceId} with attributes: ${debugStringify(powerSourceCluster)}`);
      } else if (powerSourceCluster.batChargeLevel !== undefined || powerSourceCluster.batReplacementNeeded !== undefined || powerSourceCluster.batReplaceability !== undefined) {
        device.createDefaultPowerSourceBatteryClusterServer(
          powerSourceCluster.batPercentRemaining,
          powerSourceCluster.batChargeLevel,
          powerSourceCluster.batVoltage,
          powerSourceCluster.batReplaceability,
        );
        this.log.debug(`Created Power Source Battery Cluster for device ${deviceId} with attributes: ${debugStringify(powerSourceCluster)}`);
      } else if (powerSourceCluster.wiredCurrentType !== undefined) {
        device.createDefaultPowerSourceWiredClusterServer(powerSourceCluster.wiredCurrentType);
        this.log.debug(`Created Power Source Wired Cluster for device ${deviceId} with attributes: ${debugStringify(powerSourceCluster)}`);
      }
    }

    /**
     * Add behaviors for all other clusters based on cluster name, excluding the ones we already handled above since they have custom handling
     * and are not guaranteed to be included in the config
     */
    for (const cluster of Object.keys(jsonPayload.clusters).filter((c) => c !== 'BridgedDeviceBasicInformation' && c !== 'PowerSource')) {
      const found = getSupportedCluster(cluster);
      if (!found?.id) {
        this.log.warn(`Cluster '${cluster}' is not supported. Skipping.`);
        continue;
      }
      const behavior = getBehaviourTypeFromClusterServerId(found.id);
      /* istanbul ignore if -- current Matterbridge registry exposes a behavior for every supported cluster. */
      if (!behavior) {
        this.log.warn(`Cluster '${cluster}' does not have a defined behavior. Skipping.`);
        continue;
      }
      this.log.debug(`*Adding behavior '${behavior.name}' to device '${deviceId}' for cluster '${cluster}' with configuration: ${debugStringify(jsonPayload.clusters[cluster])}`);
      device.behaviors.require(behavior, jsonPayload.clusters[cluster]);
    }

    device.addRequiredClusters();
    /**
     * This will run in the background and we don't want to await it here since we want to be able to process multiple MQTT messages in quick succession without waiting
     * for each device registration to complete, and any errors will be caught and logged by the fireAndForget utility
     */
    fireAndForget(this.registerDevice(device), this.log, `Failed to register device ${deviceId}`);
  }

  destroyDevice(deviceId: string): void {
    this.log.info(`Destroying device with ID '${deviceId}'`);
    const device = this.getDeviceById(deviceId);
    if (!device) {
      this.log.warn(`Cannot destroy device with ID '${deviceId}' because it is not registered.`);
      return;
    }
    fireAndForget(this.unregisterDevice(device), this.log, `Failed to unregister device ${deviceId}`);
  }

  /**
   * Handles an MQTT message with subTopic `state` by updating the corresponding device's clusters with the provided state.
   *
   * @param {string} topic - The MQTT topic on which the message was received. Expected format: `<baseTopic>/<deviceId>/state/<endpointName>`.
   * @param {string} payload - The raw JSON string payload of the message, expected to be a map of cluster names to cluster attributes objects.
   */
  async updateHandler(topic: string, payload: string): Promise<void> {
    const { deviceId, subTopic, endpointName } = this.mqttTopicParser(topic) ?? {};
    if (!deviceId || !subTopic || !endpointName) {
      this.log.warn(`Skipping MQTT message with topic '${topic}' during updateHandler because it does not match expected format.`);
      return;
    }
    const device = this.getDeviceById(deviceId);
    if (!device) {
      this.log.warn(`Skipping MQTT message with topic '${topic}' during updateHandler because device with ID '${deviceId}' is not registered.`);
      return;
    }
    // TODO: add support for composed device types in the future if there is demand for it
    // istanbul ignore else
    if (endpointName === 'root') {
      const parsedPayload = JSON.parse(payload);
      for (const cluster of Object.keys(parsedPayload)) {
        device.log.debug(`Setting cluster '${cluster}' for device '${deviceId}' with payload: ${debugStringify(parsedPayload[cluster])}`);
        if (!device.hasClusterServer(cluster)) {
          device.log.warn(`Device '${deviceId}' does not have cluster '${cluster}' defined. Skipping cluster configuration for this cluster.`);
          continue;
        }
        await device.setCluster(cluster, parsedPayload[cluster], device.log);
      }
    }
  }
}
