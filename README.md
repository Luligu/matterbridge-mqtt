<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge mqtt plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-mqtt/actions/workflows/build.yml/badge.svg)
![Jest coverage](https://img.shields.io/badge/Jest%20coverage-100%25-brightgreen)

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Features

The **matterbridge-mqtt** plugin bridges any MQTT-capable device into the Matter ecosystem through Matterbridge, without requiring device-specific firmware or custom integrations.

- **Zero-code device onboarding** — send a single retained `config` message and Matterbridge automatically creates and registers the corresponding Matter endpoint.
- **Broad device-type support** — lights (on/off, dimmable, colour-temperature, extended colour), plugs and outlets, mounted switches, sensors (contact, temperature, humidity, pressure, flow, light, occupancy, smoke/CO, air quality, rain, soil, water freeze/leak), pump, water valve, power source, and electrical sensor.
- **Live state sync** — retained `state` messages drive cluster attribute updates so controllers always see the current device state, even after a restart.
- **Matter command forwarding** — every Matter command (e.g. `on`, `off`, `moveToLevel`) is published back to the device's `command` topic as a structured JSON payload.
- **Flexible MQTT connectivity** — configurable broker host, port, protocol version (3/4/5), credentials, client ID, and full TLS support (CA certificate, client certificate/key, `rejectUnauthorized`).
- **Topic-based multi-device management** — a single broker connection and a single base topic handle an arbitrary number of devices; each device is identified by its `deviceId` path segment.

---

# How it works

Topic: matterbridge

## Publish

Each device shall publish with retain:

### config

- **matterbridge/deviceid/config/root**

only the fixed and optional attributes shall be published here

```typescript
const config = {
  deviceTypes: ['Dimmable Light'],
  clusters: { BridgedDeviceBasicInformation: { NodeLabel: 'Light 1', SerialNumber: 'xxx-yyy-xxx' }, LevelControl: { onLevel: 128 } },
};
publish('matterbridge/light1/config/root', JSON.stringify(config));
```

### state

- **matterbridge/deviceid/state/root**

only the current attributes shall be published here

```typescript
const state = { OnOff: { onOff: false }, LevelControl: { currentLevel: 254 } };
publish('matterbridge/deviceid/state/root', JSON.stringify(state));
```

## Subscribe

Each device shall subscribe:

### command

- **matterbridge/deviceid/command/root**

It will receive all Matter commands.

```typescript
Topic: 'matterbridge/deviceid/command/root'
Payload: "{"cluster":"OnOff","command":"on","request": MatterRequest | undefined }"
```
