# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge mqtt plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Luligu/b21088ab9c9f2b119b42c33f0fef218d/raw/docker.json)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-mqtt/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-mqtt/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-mqtt/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-mqtt)
[![tested with Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev)
[![styled with Oxc](https://img.shields.io/badge/styled_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/formatter.html)
[![linted with Oxc](https://img.shields.io/badge/linted_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/linter.html)
[![TypeScript Native](https://img.shields.io/badge/TypeScript_Native-3178C6?logo=typescript&logoColor=white)](https://github.com/microsoft/typescript-go)
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
- **Selective attribute subscription** — a retained `subscribe` message lets each device declare exactly which cluster attributes it wants pushed back to its `write` topic.
- **Matter state forwarding** — every Matter attribute change (e.g. `onOff`, `currentLevel`) is published back to the device's `write` topic as a structured JSON payload.
- **Flexible MQTT connectivity** — configurable broker host, port, protocol version (3/4/5), credentials, client ID, and full TLS support (CA certificate, client certificate/key, `rejectUnauthorized`).
- **Topic-based multi-device management** — a single broker connection and a single base topic handle an arbitrary number of devices; each device is identified by its `deviceId` path segment.
- **Frontend** — a plugin frontend showing the created devices and all MQTT data.

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

Publish here only the fixed and optional attributes.

```typescript
const config = {
  deviceTypes: ['DimmableLight'],
  clusters: { BridgedDeviceBasicInformation: { nodeLabel: 'Light 1', serialNumber: 'xxx-yyy-xxx' }, LevelControl: { onLevel: 128 } },
};
publish('matterbridge/light1/config/root', JSON.stringify(config), { retain: true, qos: 2 });
```

### state

- **matterbridge/deviceid/state/root**

Publish here only the current attribute values.

```typescript
const state = { OnOff: { onOff: false }, LevelControl: { currentLevel: 254 } };
publish('matterbridge/deviceid/state/root', JSON.stringify(state), { retain: true, qos: 2 });
```

### subscribe

- **matterbridge/deviceid/subscribe/root**

Publish here only the attribute changes that the device wants to receive from the controller.

```typescript
const subscribe = { OnOff: ['onOff'], LevelControl: ['currentLevel'] };
publish('matterbridge/deviceid/state/root', JSON.stringify(subscribe), { retain: true, qos: 2 });
```

## Subscribe

Each device may subscribe to `write` messages:

```typescript
subscribe('matterbridge/deviceid/write/root', { qos: 2 });
```

and will receive all attributes changes it subscribed to.

```typescript
{ OnOff: { onOff: false }, LevelControl: { currentLevel: 254 } }
```

### Test script

See [src/test-publish.ts](src/test-publish.ts) for working examples. It is a stand-alone helper that reads `~/.matterbridge/matterbridge-mqtt.config.json`, connects to the configured MQTT broker, and publishes retained `config`, `state` and `subscribe` messages for every supported device type.

Run it after building:

```shell
node dist/test-publish.js
```

Parameters:

- `--filter <name>` — only publish devices whose name contains `<name>` (e.g. `--filter Light` for all device types including `Light`).
- `--update` — publish a changed `state` to the state topic of each device (state change only, no `config` or `subscribe`).
- `--delete` — publish empty retained payloads to clear the topics instead of publishing `config`/`state`/`subscribe`. It will remove the devices from Matterbridge (no restart needed).

---

# Todo

- [ ] Add composed device types

## Development guide

Refer to the Matterbridge [Development guide](https://matterbridge.io/README-DEV.html) for other guidelines.

## Repository toolchain

See [TOOLCHAIN.md](./TOOLCHAIN.md) for compilers, linting, formatting, testing, and editor support.

## Shared agent instructions

See [SHARED-AGENTS.md](./SHARED-AGENTS.md) for shared guidance, rules, skills, and configuration for coding agents.

See [.agents/README.md](./.agents/README.md) for the shared instructions layout and versioning.

## Shared dev container support

See [.devcontainer/README.md](./.devcontainer/README.md) for the shared development container setup and usage.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Style guide

See [STYLEGUIDE.md](./STYLEGUIDE.md) for code style, naming, documentation, and testing conventions.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and notable changes.

## Issues and feature requests

Report bugs and suggest improvements on [GitHub Issues](https://github.com/Luligu/matterbridge-mqtt/issues).

## License

Licensed under the [Apache License 2.0](./LICENSE).

## Support the project

If you find this project useful, please consider giving it a star on [GitHub](https://github.com/Luligu/matterbridge-mqtt) and sponsoring it. Your support helps maintain and improve the project.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://www.buymeacoffee.com/luligugithub)
