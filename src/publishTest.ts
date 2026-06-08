// oxlint-disable no-console unicorn/no-process-exit
/* istanbul ignore file */
/**
 * Stand-alone MQTT publish test for matterbridge-mqtt.
 *
 * Reads ~/.matterbridge/matterbridge-mqtt.config.json, connects to the
 * configured MQTT broker, and publishes retained config and state messages
 * for every supported device type.
 *
 * Run after building:
 *   node dist/publishTest.js
 *
 * @file publishTest.ts
 * @author Luca Liguori
 * @created 2026-06-08
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

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { PowerSource } from 'matterbridge/matter/clusters';
import { connectAsync } from 'mqtt';
import type { IClientOptions, IClientPublishOptions } from 'mqtt';

import type { MqttPlatformConfig } from './module.js';

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

const configPath = path.join(homedir(), '.matterbridge', 'matterbridge-mqtt.config.json');

let config: MqttPlatformConfig;
try {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  config = JSON.parse(readFileSync(configPath, 'utf8')) as MqttPlatformConfig;
} catch {
  console.error(`Config file not found or invalid: ${configPath}`);
  process.exit(1);
}

const baseTopic = config.topic ?? 'matterbridge';

// --------------------------------------------------------------------------
// Device definitions
// --------------------------------------------------------------------------

interface DeviceEntry {
  id: string;
  name: string;
  deviceTypes: string[];
  configClusters: Record<string, unknown>;
  state: Record<string, unknown>;
}

const DEVICES: DeviceEntry[] = [
  // Chapter 2. Utility Device Types
  {
    id: 'test-power-source',
    name: 'Power Source',
    deviceTypes: ['Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200, batVoltage: 3000 } },
    state: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Warning, batPercentRemaining: 150, batVoltage: 2800 } },
  },
  {
    id: 'test-electrical-sensor',
    name: 'Electrical Sensor',
    deviceTypes: ['Electrical Sensor'],
    configClusters: {},
    state: { ElectricalPowerMeasurement: { activePower: 1200, voltage: 2300, activeCurrent: 520 } },
  },

  // Chapter 4. Lighting Device Types
  {
    id: 'test-onoff-light',
    name: 'OnOff Light',
    deviceTypes: ['OnOff Light', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
  },
  {
    id: 'test-dimmable-light',
    name: 'Dimmable Light',
    deviceTypes: ['Dimmable Light', 'Power Source'],
    configClusters: { LevelControl: { onLevel: 128 }, PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 128 } },
  },
  {
    id: 'test-color-temp-light',
    name: 'Color Temperature Light',
    deviceTypes: ['Color Temperature Light', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 }, ColorControl: { colorTemperatureMireds: 370 } },
  },
  {
    id: 'test-extended-color-light',
    name: 'Extended Color Light',
    deviceTypes: ['Extended Color Light', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 }, ColorControl: { currentHue: 128, currentSaturation: 200 } },
  },

  // Chapter 5. Smart Plugs/Outlets and other Actuators Device Types
  {
    id: 'test-onoff-plugin-unit',
    name: 'OnOff Plugin Unit',
    deviceTypes: ['OnOff Plugin Unit', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
  },
  {
    id: 'test-dimmable-plugin-unit',
    name: 'Dimmable PlugIn Unit',
    deviceTypes: ['Dimmable PlugIn Unit', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 } },
  },
  {
    id: 'test-mounted-onoff-control',
    name: 'Mounted OnOff Control',
    deviceTypes: ['Mounted OnOff Control', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
  },
  {
    id: 'test-mounted-dimmable-control',
    name: 'Mounted Dimmable Load Control',
    deviceTypes: ['Mounted Dimmable Load Control', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false }, LevelControl: { currentLevel: 100 } },
  },
  {
    id: 'test-pump',
    name: 'Pump',
    deviceTypes: ['Pump', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false }, PumpConfigurationAndControl: { effectiveOperationMode: 0, effectiveControlMode: 0 } },
  },
  {
    id: 'test-water-valve',
    name: 'Water Valve',
    deviceTypes: ['Water Valve', 'Power Source'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { ValveConfigurationAndControl: { currentState: 0, targetState: 0 } },
  },

  // Chapter 7. Sensor Device Types
  {
    id: 'test-contact-sensor',
    name: 'Contact Sensor',
    deviceTypes: ['Contact Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { BooleanState: { stateValue: false } },
  },
  {
    id: 'test-light-sensor',
    name: 'Light Sensor',
    deviceTypes: ['Light Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { IlluminanceMeasurement: { measuredValue: 10000 } },
  },
  {
    id: 'test-occupancy-sensor',
    name: 'Occupancy Sensor',
    deviceTypes: ['Occupancy Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { OccupancySensing: { occupancy: { occupied: false } } },
  },
  {
    id: 'test-temperature-sensor',
    name: 'Temperature Sensor',
    deviceTypes: ['Temperature Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 180 } },
    state: { TemperatureMeasurement: { measuredValue: 2100 } },
  },
  {
    id: 'test-pressure-sensor',
    name: 'Pressure Sensor',
    deviceTypes: ['Pressure Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 160 } },
    state: { PressureMeasurement: { measuredValue: 1013 } },
  },
  {
    id: 'test-flow-sensor',
    name: 'Flow Sensor',
    deviceTypes: ['Flow Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 140 } },
    state: { FlowMeasurement: { measuredValue: 100 } },
  },
  {
    id: 'test-humidity-sensor',
    name: 'Humidity Sensor',
    deviceTypes: ['Humidity Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 130 } },
    state: { RelativeHumidityMeasurement: { measuredValue: 5500 } },
  },
  {
    id: 'test-smoke-co-alarm',
    name: 'Smoke CO Alarm',
    deviceTypes: ['Smoke CO Alarm', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { SmokeCoAlarm: { smokeState: 0, coState: 0 } },
  },
  {
    id: 'test-air-quality-sensor',
    name: 'Air Quality Sensor',
    deviceTypes: ['Air Quality Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { AirQuality: { airQuality: 1 } },
  },
  {
    id: 'test-water-freeze-detector',
    name: 'Water Freeze Detector',
    deviceTypes: ['Water Freeze Detector', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 170 } },
    state: { BooleanState: { stateValue: false } },
  },
  {
    id: 'test-water-leak-detector',
    name: 'Water Leak Detector',
    deviceTypes: ['Water Leak Detector', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 150 } },
    state: { BooleanState: { stateValue: false } },
  },
  {
    id: 'test-rain-sensor',
    name: 'Rain Sensor',
    deviceTypes: ['Rain Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 160 } },
    state: { BooleanState: { stateValue: false } },
  },
  {
    id: 'test-soil-sensor',
    name: 'Soil Sensor',
    deviceTypes: ['Soil Sensor', 'Power Source'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 140 } },
    state: { SoilMeasurement: { soilMoistureMeasuredValue: 60 } },
  },
];

// --------------------------------------------------------------------------
// Connect
// --------------------------------------------------------------------------

const clientOptions: IClientOptions = {
  port: config.port,
  protocolVersion: config.protocolVersion,
  rejectUnauthorized: config.rejectUnauthorized,
};
if (config.clientId) clientOptions.clientId = config.clientId;
if (config.username) clientOptions.username = config.username;
if (config.password) clientOptions.password = config.password;
if (config.ca) clientOptions.ca = readFileSync(config.ca);
if (config.cert) clientOptions.cert = readFileSync(config.cert);
if (config.key) clientOptions.key = readFileSync(config.key);

console.log(`Connecting to ${config.host}:${config.port} (protocol v${config.protocolVersion}) ...`);
const client = await connectAsync(config.host, clientOptions);
console.log(`Connected. Publishing to base topic "${baseTopic}".\n`);

// --------------------------------------------------------------------------
// Publish
// --------------------------------------------------------------------------

const pubOptions: IClientPublishOptions = { retain: true, qos: 2 };

for (const device of DEVICES) {
  const configPayload = JSON.stringify({
    deviceTypes: device.deviceTypes,
    clusters: {
      BridgedDeviceBasicInformation: {
        nodeLabel: device.name,
        serialNumber: `TEST-${device.id}`,
      },
      ...device.configClusters,
    },
  });
  const statePayload = JSON.stringify(device.state);

  const configTopic = `${baseTopic}/${device.id}/config/root`;
  const stateTopic = `${baseTopic}/${device.id}/state/root`;

  await client.publishAsync(configTopic, configPayload, pubOptions);
  await client.publishAsync(stateTopic, statePayload, pubOptions);

  console.log(`[${device.name}]`);
  console.log(`  config → ${configTopic}`);
  console.log(`  state  → ${stateTopic}`);
}

await client.endAsync();
console.log(`\nDone. Published config + state for ${DEVICES.length} device(s).`);
