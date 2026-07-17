<!-- eslint-disable markdown/no-missing-label-refs -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge mqtt plugin changelog

[![npm version](https://img.shields.io/npm/v/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-mqtt.svg)](https://www.npmjs.com/package/matterbridge-mqtt)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
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

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-mqtt and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [0.0.12] - Dev branch

### Breaking changes

- [matterbridge]: Require matterbridge v.3.10.0 with matter v.1.6.0 and matter.js v.0.17.5.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.11] - 2026-07-17

### Breaking changes

- [matterbridge]: Require matterbridge v.3.9.0.

### Changed

- [package]: Apply uniform style.
- [package]: Upgrade package.
- [package]: Update dependencies.
- [toolchain]: Migrate to the native toolchain (tsgo + oxlint + oxfmt + vitest). Replace ESLint/Prettier with Oxc, migrate the unit tests from Jest to Vitest, and move them from `src/` to `vitest/`.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.10] - 2026-06-22

### Added

- [platform]: Add snackbar messages.

### Changed

- [package]: Update dependencies.
- [package]: Bump `node-ansi-logger` to v.3.3.0.
- [package]: Bump `node-persist-manager` to v.2.1.0.
- [package]: Bump `@typescript/native-preview` to v.7.0.0-dev.20260621.1.

### Fixed

- [frontend]: Set base to `./` for production. This allows connection from Ingress.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.9] - 2026-06-20

### Changed

- [platform]: Require Matterbridge 3.9.1.
- [package]: Update dependencies.
- [package]: Bump `@typescript/native-preview` to v.7.0.0-dev.20260620.1.
- [oxlint]: Bump `oxlint` config to v.1.0.13.
- [oxfmt]: Bump `oxfmt` config to v.1.0.4.
- [devcontainer]: Bump `.devcontainer/devcontainer.json` config to v.1.0.4.
- [package]: Bump `.vscode/extensions.json` config to v.1.0.4.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.8] - 2026-06-18

### Added

- [codex]: Add `AGENTS.md` for Codex.
- [codex]: Add `.codex\config.toml` configuration for Codex.
- [codex]: Add `.codex\rules\default.rules` rules (sandbox) for Codex.

### Changed

- [package]: Update dependencies.
- [package]: Bump package to `automator` v.3.1.12 and the new toolchain.
- [package]: Bump `.devcontainer/devcontainer.json` config to v.1.0.3.
- [package]: Bump `.vscode/settings.json` config to v.1.0.3.
- [package]: Bump `.vscode/extensions.json` config to v.1.0.3.
- [package]: Bump `.vscode/tasks.json` config to v.1.0.3.
- [workflows]: Bump `build.yml` workflow to v.2.0.5.
- [workflows]: Bump `codecov.yml` workflow to v.2.0.6.
- [workflows]: Bump `publish.yml` workflow to v.2.0.5.
- [workflows]: Bump `codeql.yml` workflow to v.2.0.0.
- [oxlint]: Bump `oxlint` config to v.1.0.10.
- [oxfmt]: Bump `oxfmt` config to v.1.0.3.

### Fixed

- [subscribe]: Defer subscribe to configure phase. Thanks Dischi (https://github.com/Luligu/matterbridge-mqtt/issues/6).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.7] - 2026-06-12

### Added

- Refactor `test-publish` to allow also state update.
- Add plugin frontend (it uses the new Matterbridge api).

### Changed

- Bump `@types/node` to v.25.9.3.
- Bump `@typescript/native-preview` to v.7.0.0-dev.20260611.2.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.6] - 2026-06-10

### Added

- Require Matterbridge 3.9.0.
- Add subscribe topic **matterbridge/deviceid/subscribe/root**.
- Remove Jest and add Vitest.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.5] - 2026-06-09

### Added

- Require Matterbridge 3.8.1.
- Add handler to create all device types.
- Add MQTT packet metadata forwarding to message handlers.
- Add retained MQTT message logging.
- Add explicit MQTT 5 retained message replay on subscribe.
- Add `destroyDevice()` support when a config topic receives an empty payload.
- Add handling for empty state payloads without JSON parse errors.
- Add validation against white/black list selections when creating devices.
- Add tests for `mqttMessageHandler()`, `createDevice()`, `destroyDevice()`, and `updateHandler()`.

### Changed

- Publish test config and state messages with QoS 2 and retain enabled.
- Subscribe to MQTT topics with QoS 2.
- Bump `@typescript/native-preview` to v.7.0.0-dev.20260608.1.
- Bump `@typescript/native-preview` to v.7.0.0-dev.20260609.1.
- Bump `oxlint` to v.1.69.0.
- Bump `oxfmt` to v.0.54.0.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.4] - 2026-06-08

### Added

- Add `Power Source` device type.
- Add `Soil Sensor` device type.

### Changed

- Update `README.md`.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [0.0.3] - 2026-06-07

- Initial commit (repository reset).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->
