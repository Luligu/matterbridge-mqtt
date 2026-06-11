/**
 * Stand-alone MQTT publish test for matterbridge-mqtt.
 *
 * Reads ~/.matterbridge/matterbridge-mqtt.config.json, connects to the
 * configured MQTT broker, and publishes retained config state subscribe messages
 * for every supported device type.
 *
 * Run after building:
 *   node dist/test-publish.js
 *
 * Parameters:
 *   --filter <name>   Only publish devices whose name contains <name>.
 *   --update          Publish a changed state to the state topic of each device (state change only).
 *   --delete          Publish empty retained payloads to clear the topics instead of publishing config/state/subscribe.
 *
 * @file test-publish.ts
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

/* istanbul ignore file cause is just a test script */

// oxlint-disable no-console unicorn/no-process-exit

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { AirQuality, PowerSource, SmokeCoAlarm, ValveConfigurationAndControl } from 'matterbridge/matter/clusters';
import { getParameter, hasParameter } from 'matterbridge/utils';
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
  update?: Record<string, unknown>;
  subscribe?: Record<string, string[]>;
}

const DEVICES: DeviceEntry[] = [
  // Chapter 2. Utility Device Types
  {
    id: 'test-power-source',
    name: 'Power Source',
    deviceTypes: ['PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200, batVoltage: 3000 } },
    state: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Warning, batPercentRemaining: 150, batVoltage: 2800 } },
    update: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Critical, batPercentRemaining: 50, batVoltage: 2600 } },
  },
  {
    id: 'test-electrical-sensor',
    name: 'Electrical Sensor',
    deviceTypes: ['ElectricalSensor'],
    configClusters: {},
    state: { ElectricalPowerMeasurement: { activePower: 1200, voltage: 2300, activeCurrent: 520 } },
    update: { ElectricalPowerMeasurement: { activePower: 800, voltage: 2310, activeCurrent: 350 } },
  },

  // Chapter 4. Lighting Device Types
  {
    id: 'test-onoff-light',
    name: 'OnOff Light',
    deviceTypes: ['OnOffLight', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
    update: { OnOff: { onOff: true } },
    subscribe: { OnOff: ['onOff'] },
  },
  {
    id: 'test-dimmable-light',
    name: 'Dimmable Light',
    deviceTypes: ['DimmableLight', 'PowerSource'],
    configClusters: { LevelControl: { onLevel: 128 }, PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 128 } },
    update: { OnOff: { onOff: true }, LevelControl: { currentLevel: 64 } },
    subscribe: { OnOff: ['onOff'], LevelControl: ['currentLevel'] },
  },
  {
    id: 'test-color-temp-light',
    name: 'Color Temperature Light',
    deviceTypes: ['ColorTemperatureLight', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 }, ColorControl: { colorTemperatureMireds: 370 } },
    update: { OnOff: { onOff: true }, LevelControl: { currentLevel: 250 }, ColorControl: { colorTemperatureMireds: 250 } },
    subscribe: { OnOff: ['onOff'], LevelControl: ['currentLevel'], ColorControl: ['colorTemperatureMireds'] },
  },
  {
    id: 'test-extended-color-light',
    name: 'Extended Color Light',
    deviceTypes: ['ExtendedColorLight', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 }, ColorControl: { currentHue: 128, currentSaturation: 200 } },
    update: { OnOff: { onOff: true }, LevelControl: { currentLevel: 100 }, ColorControl: { currentHue: 64, currentSaturation: 254 } },
    subscribe: {
      OnOff: ['onOff'],
      LevelControl: ['currentLevel'],
      ColorControl: ['colorMode', 'colorTemperatureMireds', 'currentHue', 'currentSaturation', 'currentX', 'currentY'],
    },
  },

  // Chapter 5. Smart Plugs/Outlets and other Actuators Device Types
  {
    id: 'test-onoff-plugin-unit',
    name: 'OnOff Plugin Unit',
    deviceTypes: ['OnOffPlugInUnit', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
    update: { OnOff: { onOff: true } },
  },
  {
    id: 'test-dimmable-plugin-unit',
    name: 'Dimmable PlugIn Unit',
    deviceTypes: ['DimmablePlugInUnit', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 } },
    update: { OnOff: { onOff: true }, LevelControl: { currentLevel: 100 } },
  },
  {
    id: 'test-mounted-onoff-control',
    name: 'Mounted OnOff Control',
    deviceTypes: ['MountedOnOffControl', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false } },
    update: { OnOff: { onOff: true } },
  },
  {
    id: 'test-mounted-dimmable-control',
    name: 'Mounted Dimmable Load Control',
    deviceTypes: ['MountedDimmableLoadControl', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false }, LevelControl: { currentLevel: 100 } },
    update: { OnOff: { onOff: true }, LevelControl: { currentLevel: 200 } },
  },
  {
    id: 'test-pump',
    name: 'Pump',
    deviceTypes: ['Pump', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { OnOff: { onOff: false }, PumpConfigurationAndControl: { effectiveOperationMode: 0, effectiveControlMode: 0 } },
    update: { OnOff: { onOff: true }, PumpConfigurationAndControl: { effectiveOperationMode: 0, effectiveControlMode: 0 } },
  },
  {
    id: 'test-water-valve',
    name: 'Water Valve',
    deviceTypes: ['WaterValve', 'PowerSource'],
    configClusters: { PowerSource: { wiredCurrentType: PowerSource.WiredCurrentType.Ac } },
    state: { ValveConfigurationAndControl: { currentState: ValveConfigurationAndControl.ValveState.Closed, targetState: ValveConfigurationAndControl.ValveState.Closed } },
    update: { ValveConfigurationAndControl: { currentState: ValveConfigurationAndControl.ValveState.Open, targetState: ValveConfigurationAndControl.ValveState.Open } },
  },

  // Chapter 7. Sensor Device Types
  {
    id: 'test-contact-sensor',
    name: 'Contact Sensor',
    deviceTypes: ['ContactSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { BooleanState: { stateValue: false } },
    update: { BooleanState: { stateValue: true } },
  },
  {
    id: 'test-light-sensor',
    name: 'Light Sensor',
    deviceTypes: ['LightSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { IlluminanceMeasurement: { measuredValue: 10000 } },
    update: { IlluminanceMeasurement: { measuredValue: 5000 } },
  },
  {
    id: 'test-occupancy-sensor',
    name: 'Occupancy Sensor',
    deviceTypes: ['OccupancySensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { OccupancySensing: { occupancy: { occupied: false } } },
    update: { OccupancySensing: { occupancy: { occupied: true } } },
  },
  {
    id: 'test-temperature-sensor',
    name: 'Temperature Sensor',
    deviceTypes: ['TemperatureSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 180 } },
    state: { TemperatureMeasurement: { measuredValue: 2100 } },
    update: { TemperatureMeasurement: { measuredValue: 2500 } },
  },
  {
    id: 'test-pressure-sensor',
    name: 'Pressure Sensor',
    deviceTypes: ['PressureSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 160 } },
    state: { PressureMeasurement: { measuredValue: 1013 } },
    update: { PressureMeasurement: { measuredValue: 1020 } },
  },
  {
    id: 'test-flow-sensor',
    name: 'Flow Sensor',
    deviceTypes: ['FlowSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 140 } },
    state: { FlowMeasurement: { measuredValue: 100 } },
    update: { FlowMeasurement: { measuredValue: 150 } },
  },
  {
    id: 'test-humidity-sensor',
    name: 'Humidity Sensor',
    deviceTypes: ['HumiditySensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 130 } },
    state: { RelativeHumidityMeasurement: { measuredValue: 5500 } },
    update: { RelativeHumidityMeasurement: { measuredValue: 6000 } },
  },
  {
    id: 'test-smoke-co-alarm',
    name: 'Smoke CO Alarm',
    deviceTypes: ['SmokeCOAlarm', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { SmokeCoAlarm: { smokeState: SmokeCoAlarm.AlarmState.Normal, coState: SmokeCoAlarm.AlarmState.Normal } },
    update: { SmokeCoAlarm: { smokeState: SmokeCoAlarm.AlarmState.Critical, coState: SmokeCoAlarm.AlarmState.Normal } },
  },
  {
    id: 'test-air-quality-sensor',
    name: 'Air Quality Sensor',
    deviceTypes: ['AirQualitySensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeState: PowerSource.BatChargeState.IsNotCharging, batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 200 } },
    state: { AirQuality: { airQuality: AirQuality.AirQualityEnum.Good } },
    update: { AirQuality: { airQuality: AirQuality.AirQualityEnum.Poor } },
  },
  {
    id: 'test-water-freeze-detector',
    name: 'Water Freeze Detector',
    deviceTypes: ['WaterFreezeDetector', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 170 } },
    state: { BooleanState: { stateValue: false } },
    update: { BooleanState: { stateValue: true } },
  },
  {
    id: 'test-water-leak-detector',
    name: 'Water Leak Detector',
    deviceTypes: ['WaterLeakDetector', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 150 } },
    state: { BooleanState: { stateValue: false } },
    update: { BooleanState: { stateValue: true } },
  },
  {
    id: 'test-rain-sensor',
    name: 'Rain Sensor',
    deviceTypes: ['RainSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 160 } },
    state: { BooleanState: { stateValue: false } },
    update: { BooleanState: { stateValue: true } },
  },
  {
    id: 'test-soil-sensor',
    name: 'Soil Sensor',
    deviceTypes: ['SoilSensor', 'PowerSource'],
    configClusters: { PowerSource: { batChargeLevel: PowerSource.BatChargeLevel.Ok, batPercentRemaining: 140 } },
    state: { SoilMeasurement: { soilMoistureMeasuredValue: 60 } },
    update: { SoilMeasurement: { soilMoistureMeasuredValue: 40 } },
  },
];

// --------------------------------------------------------------------------
// Connect
// --------------------------------------------------------------------------

const clientOptions: IClientOptions = {
  port: config.port,
  protocolVersion: config.protocolVersion,
  rejectUnauthorized: config.rejectUnauthorized,
  clientId: `test-${Math.random().toString(16).slice(2, 8)}`,
};
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
const filter = getParameter('filter');
if (filter) console.log(`Filtering devices with name containing "${filter}"...\n`);

if (hasParameter('update')) {
  for (const device of DEVICES) {
    if (filter && !device.name.includes(filter)) continue;
    const stateTopic = `${baseTopic}/${device.id}/state/root`;
    await client.publishAsync(stateTopic, JSON.stringify(device.update ?? device.state), pubOptions);
    console.log(`Updated [${device.name}]`);
    console.log(`  state → ${stateTopic}`);
  }
  await client.endAsync();
  console.log(`\nDone. Published state change for ${DEVICES.length} device(s).`);
  process.exit(0);
}

for (const device of DEVICES) {
  if (filter && !device.name.includes(filter)) continue;
  const configPayload = JSON.stringify({
    deviceTypes: device.deviceTypes,
    clusters: {
      BridgedDeviceBasicInformation: {
        nodeLabel: device.name,
        serialNumber: device.id,
        productName: 'Matterbridge MQTT Test Device',
      },
      ...device.configClusters,
    },
  });
  const statePayload = JSON.stringify(device.state);

  const configTopic = `${baseTopic}/${device.id}/config/root`;
  const stateTopic = `${baseTopic}/${device.id}/state/root`;
  const subscribeTopic = `${baseTopic}/${device.id}/subscribe/root`;

  await client.publishAsync(configTopic, hasParameter('delete') ? '' : configPayload, pubOptions);
  await client.publishAsync(stateTopic, hasParameter('delete') ? '' : statePayload, pubOptions);
  if (device.subscribe) {
    const subscribePayload = JSON.stringify(device.subscribe);
    await client.publishAsync(subscribeTopic, hasParameter('delete') ? '' : subscribePayload, pubOptions);
  }

  console.log(`${hasParameter('delete') ? 'Deleted' : 'Published'} [${device.name}]`);
  console.log(`  config → ${configTopic}`);
  console.log(`  state  → ${stateTopic}`);
  if (device.subscribe) {
    console.log(`  subscribe → ${subscribeTopic}`);
  }
}

await client.endAsync();
console.log(`\nDone. Published config + state + subscribe for ${DEVICES.length} device(s).`);
