<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge mqtt plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-mqtt/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-mqtt/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-mqtt/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-mqtt)
[![formatted with oxfmt](https://img.shields.io/badge/formatted_with-oxfmt-9BE4E0.svg)](https://oxc.rs/docs/guide/usage/formatter.html)
[![linted with oxlint](https://img.shields.io/badge/linted_with-oxlint-9BE4E0.svg)](https://oxc.rs/docs/guide/usage/linter.html)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![tsgo](https://img.shields.io/badge/tsgo-3178C6?logo=typescript&logoColor=white)](https://github.com/microsoft/typescript-go)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
![under development](https://img.shields.io/badge/status-under%20development-orange)

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

## Configuration

The plugin is configured through the Matterbridge frontend. The settings are stored in `~/.matterbridge/matterbridge-mqtt.config.json`.

| Parameter            | Default            | Description                                                                                                        |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `host`               | `mqtt://localhost` | Broker URL. Use `mqtt://` for plain TCP, `mqtts://` for TLS, `ws://` for WebSocket, `wss://` for secure WebSocket. |
| `port`               | `1883`             | Broker port. Common values: `1883` (plain), `8883` (TLS), `9001` (WebSocket).                                      |
| `protocolVersion`    | `5`                | MQTT protocol version: `3`, `4` (MQTT 3.1.1), or `5`.                                                              |
| `clientId`           | _(auto)_           | Client identifier sent to the broker. Leave empty to let the library generate one.                                 |
| `username`           | _(empty)_          | Username for broker authentication. Leave empty if the broker does not require credentials.                        |
| `password`           | _(empty)_          | Password for broker authentication.                                                                                |
| `ca`                 | _(empty)_          | Path to the CA certificate file for TLS broker verification.                                                       |
| `cert`               | _(empty)_          | Path to the client certificate file for mutual TLS authentication.                                                 |
| `key`                | _(empty)_          | Path to the client private key file for mutual TLS authentication.                                                 |
| `rejectUnauthorized` | `true`             | Reject brokers with self-signed or untrusted TLS certificates. Set to `false` for self-signed brokers.             |
| `topic`              | `matterbridge`     | Base topic prefix used for all device topics.                                                                      |

### Minimal configuration example

```json
{
  "host": "mqtt://192.168.1.10",
  "port": 1883,
  "protocolVersion": 5,
  "topic": "matterbridge"
}
```

### TLS configuration example

```json
{
  "host": "mqtts://broker.example.com",
  "port": 8883,
  "protocolVersion": 5,
  "ca": "/path/to/ca.crt",
  "cert": "/path/to/client.crt",
  "key": "/path/to/client.key",
  "rejectUnauthorized": true,
  "topic": "matterbridge"
}
```

### Topic structure

All topics follow the pattern `<topic>/<deviceId>/<subTopic>/root`, where `<topic>` is the configured base topic (default: `matterbridge`) and `<deviceId>` is a stable identifier you choose for each device.

## Publish

Each device shall publish retained `config`, `state` and `subscribe` messages:

Device types, clusters and attributes all use their Matter names without spaces: device types (e.g. `PowerSource`, `DimmableLight`), clusters (e.g. `PowerSource`, `OnOff`, `LevelControl`) and attributes (e.g. `onOff`, `currentLevel`).

### config

- **matterbridge/deviceid/config/root**

only the fixed and optional attributes shall be published here

```typescript
const config = {
  deviceTypes: ['DimmableLight'],
  clusters: { BridgedDeviceBasicInformation: { nodeLabel: 'Light 1', serialNumber: 'xxx-yyy-xxx' }, LevelControl: { onLevel: 128 } },
};
publish('matterbridge/light1/config/root', JSON.stringify(config), { retain: true, qos: 2 });
```

### state

- **matterbridge/deviceid/state/root**

only the current attributes shall be published here

```typescript
const state = { OnOff: { onOff: false }, LevelControl: { currentLevel: 254 } };
publish('matterbridge/deviceid/state/root', JSON.stringify(state), { retain: true, qos: 2 });
```

### subscribe

- **matterbridge/deviceid/subscribe/root**

only the attributes changes that the device want to receive from the controller shall be published here

```typescript
const subscribe = { OnOff: ['onOff'], LevelControl: ['currentLevel'] };
publish('matterbridge/deviceid/state/root', JSON.stringify(state), { retain: true, qos: 2 });
```

## Subscribe

Each device may subscribe `write` messages:

```typescript
subscribe('matterbridge/deviceid/write/root', { qos: 2 });
```

and will receive all attributes changes it subscribed to.

---

# Todo

- [ ] Add composed device types
