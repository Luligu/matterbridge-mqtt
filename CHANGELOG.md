<!-- eslint-disable markdown/no-missing-label-refs -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge mqtt plugin changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-mqtt and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

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
- [package]: Bump `.vscode/tasks.json` config to v.1.0.2.
- [workflows]: Bump `build.yml` workflow to v.2.0.5.
- [workflows]: Bump `codecov.yml` workflow to v.2.0.6.
- [workflows]: Bump `publish.yml` workflow to v.2.0.5.
- [workflows]: Bump `codeql.yml` workflow to v.2.0.0.
- [oxlint]: Bump `oxlint` config to v.1.0.10.
- [oxfmt]: Bump `oxfmt` config to v.1.0.3.

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
