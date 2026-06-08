const NAME = 'MqttPlatform';
const MATTER_PORT = 6000;
const MATTER_CREATE_ONLY = true;

/**
 * WARNING!!!
 * The tests in this unit are supposed to run sequentially because they depend on the Matterbridge/Matter state.
 * Is not possible for timing reasons to create and destroy a Matter node each test to keep isolation.
 */

import { readFileSync } from 'node:fs';

import { jest } from '@jest/globals';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  loggerDebugSpy,
  loggerErrorSpy,
  loggerInfoSpy,
  loggerWarnSpy,
  matterbridge,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { waiter } from 'matterbridge/utils';

import initializePlugin, { MqttPlatform, type MqttPlatformConfig } from './module.js';
import { MqttService } from './mqtt.js';

const mqttConnectSpy = jest.spyOn(MqttService.prototype, 'connect').mockResolvedValue(true);
const mqttCloseSpy = jest.spyOn(MqttService.prototype, 'close').mockResolvedValue(true);
const mqttSubscribeSpy = jest.spyOn(MqttService.prototype, 'subscribe').mockResolvedValue(true);
const mqttPublishSpy = jest.spyOn(MqttService.prototype, 'publish').mockResolvedValue(true);

await setupTest(NAME, false);

describe('MqttPlatform', () => {
  let platform: MqttPlatform;
  let mqttService: MqttService;

  const defaultConfig: MqttPlatformConfig = JSON.parse(readFileSync('matterbridge-mqtt.config.json', 'utf-8'));
  const config: MqttPlatformConfig = {
    ...defaultConfig,
    debug: true,
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment();
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(() => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should throw error in load when version is not valid', () => {
    // oxlint-disable-next-line typescript/no-misused-spread
    expect(() => initializePlugin({ ...matterbridge, matterbridgeVersion: '1.0.0' }, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.8.0". Please update Matterbridge to the latest version in the frontend.',
    );
  });

  it('should initialize platform with config name', () => {
    platform = new MqttPlatform(matterbridge, log, config);
    addMatterbridgePlatform(platform);
    expect(platform).toBeInstanceOf(MqttPlatform);
    // oxlint-disable-next-line typescript/ban-ts-comment
    // @ts-ignore Accessing private property for testing
    mqttService = platform.mqtt;
    expect(mqttService).toBeInstanceOf(MqttService);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Initializing platform: ${config.name}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Finished initializing platform: ${config.name}`);
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`onStart called with reason: Test reason`);
  });

  it('should create a light device', async () => {
    mqttService.emit('connect');
    await waiter('MQTT connected', () => loggerInfoSpy.mock.calls.some((c) => /MQTT connected/.test(c[0])), false, 100, 10);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT connected/));
    loggerInfoSpy.mockClear();

    mqttService.emit('subscribed', `${config.topic}/light1/config/root`);
    await waiter('MQTT subscribed', () => loggerInfoSpy.mock.calls.some((c) => /MQTT subscribed/.test(c[0])), false, 100, 10);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT subscribed/));
    loggerInfoSpy.mockClear();

    mqttService.emit('published', `${config.topic}/light1/config/root`, 'test payload');
    await waiter('MQTT published', () => loggerInfoSpy.mock.calls.some((c) => /MQTT published/.test(c[0])), false, 100, 10);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT published/));
    loggerInfoSpy.mockClear();

    mqttService.emit('reconnect');
    await waiter('MQTT reconnecting', () => loggerDebugSpy.mock.calls.some((c) => /MQTT reconnecting/.test(c[0])), false, 100, 10);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT reconnecting/));
    loggerDebugSpy.mockClear();

    mqttService.emit('error', new Error('Test error'));
    await waiter('MQTT error', () => loggerErrorSpy.mock.calls.some((c) => /MQTT error/.test(c[0])), false, 100, 10);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT error/));
    loggerErrorSpy.mockClear();

    mqttService.emit('message', `${config.topic}/light1/config/root`, 'wrong payload');
    await waiter('Failed to parse', () => loggerErrorSpy.mock.calls.some((c) => /Failed to parse MQTT message/.test(c[0])), false, 100, 10);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to parse MQTT message/));
    loggerErrorSpy.mockClear();

    mqttService.emit(
      'message',
      `${config.topic}/light1/config/root`,
      JSON.stringify({
        deviceTypes: ['OnOff Light'],
        clusters: {
          BridgedDeviceBasicInformation: { nodeLabel: 'Light 1' },
          LevelControl: { onLevel: 128 },
        },
      }),
    );
    await waiter('MQTT message config', () => loggerDebugSpy.mock.calls.some((c) => /MQTT message on/.test(c[0])), false, 100, 10);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT message on/));
    loggerDebugSpy.mockClear();

    mqttService.emit('message', `${config.topic}/light1/state/root`, JSON.stringify({ OnOff: { onOff: false }, LevelControl: { currentLevel: 254 } }));
    await waiter('MQTT message state', () => loggerDebugSpy.mock.calls.some((c) => /MQTT message on/.test(c[0])), false, 100, 10);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT message on/));
    loggerDebugSpy.mockClear();

    mqttService.emit('close');
    await waiter('MQTT connection closed', () => loggerInfoSpy.mock.calls.some((c) => /MQTT connection closed/.test(c[0])), false, 100, 10);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/MQTT connection closed/));
    loggerInfoSpy.mockClear();
  });

  it('should call onConfigure', async () => {
    await platform.onConfigure();
    expect(loggerInfoSpy).toHaveBeenCalledWith('onConfigure called');
  });

  it('should call onShutdown with reason', async () => {
    config.unregisterOnShutdown = false;
    await platform.onShutdown('Test reason');
    config.unregisterOnShutdown = true;
    await platform.onShutdown('Test reason');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`onShutdown called with reason: Test reason`);
  });

  describe('mqttTopicParser', () => {
    it('should return null for a topic that does not match the expected format', () => {
      expect(platform.mqttTopicParser('invalid')).toBeNull();
      expect(platform.mqttTopicParser(`${config.topic}/device1`)).toBeNull();
      expect(platform.mqttTopicParser(`${config.topic}/device1/config`)).toBeNull();
      expect(platform.mqttTopicParser(`${config.topic}/device1/config/root/extra`)).toBeNull();
    });

    it('should parse a config topic', () => {
      expect(platform.mqttTopicParser(`${config.topic}/light1/config/root`)).toEqual({
        deviceId: 'light1',
        subTopic: 'config',
        endpointName: 'root',
      });
    });

    it('should parse a state topic', () => {
      expect(platform.mqttTopicParser(`${config.topic}/sensor1/state/root`)).toEqual({
        deviceId: 'sensor1',
        subTopic: 'state',
        endpointName: 'root',
      });
    });

    it('should parse a command topic', () => {
      expect(platform.mqttTopicParser(`${config.topic}/switch1/command/root`)).toEqual({
        deviceId: 'switch1',
        subTopic: 'command',
        endpointName: 'root',
      });
    });
  });

  describe('mqttMessageHandler', () => {
    it('should log error when payload is not valid JSON', () => {
      platform.mqttMessageHandler(`${config.topic}/light1/config/root`, 'invalid json');
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to parse MQTT message/));
    });

    it('should log warn when topic does not match expected format', () => {
      platform.mqttMessageHandler('invalid/topic', JSON.stringify({ key: 'value' }));
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/does not match expected format/));
    });

    it('should log info for a config message', () => {
      platform.mqttMessageHandler(`${config.topic}/light1/config/root`, JSON.stringify({ deviceTypes: ['OnOff Light'] }));
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/Received/));
    });

    it('should log info for a state message', () => {
      platform.isConfigured = true; // Set to true to allow state updates to be processed
      platform.mqttMessageHandler(`${config.topic}/sensor1/state/root`, JSON.stringify({ OnOff: { onOff: true } }));
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/Received/));
    });

    it('should log warn for an unrecognized subTopic', () => {
      platform.mqttMessageHandler(`${config.topic}/switch1/command/root`, JSON.stringify({ key: 'value' }));
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/unrecognized subTopic/));
    });
  });

  describe('createrDevice', () => {
    it('should log debug when creating a device', () => {
      platform.createrDevice('light1', 'root', { deviceTypes: ['OnOff Light'], clusters: {} });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID light1/));
    });

    it('should create a device without BridgedDeviceBasicInformation cluster', () => {
      platform.createrDevice('light2', 'root', { deviceTypes: ['OnOff Light'], clusters: {} });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID light2/));
    });

    it('should create a device with BridgedDeviceBasicInformation cluster attributes', () => {
      platform.createrDevice('light3', 'root', {
        deviceTypes: ['OnOff Light'],
        clusters: {
          BridgedDeviceBasicInformation: {
            nodeLabel: 'My Light',
            serialNumber: 'SN-001',
            vendorId: 0xfff1,
            vendorName: 'Acme',
            productName: 'Smart Light',
            softwareVersion: 1,
            softwareVersionString: '1.0.0',
            hardwareVersion: 1,
            hardwareVersionString: '1.0',
          },
        },
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID light3/));
    });

    it('should create a device with an unknown device type', () => {
      platform.createrDevice('sensor1', 'root', { deviceTypes: ['UnknownType'], clusters: {} });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID sensor1/));
    });

    it('should warn when a device type is not supported', () => {
      platform.createrDevice('unknown1', 'root', { deviceTypes: ['NotADeviceType'], clusters: {} });
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/Device type 'NotADeviceType' is not supported/));
    });

    it('should create a device with all supported device types', () => {
      platform.createrDevice('all-types', 'root', {
        deviceTypes: [
          // Chapter 2. Utility device types
          'Power Source',
          'Electrical Sensor',
          // Chapter 4. Lighting device types
          'OnOff Light',
          'Dimmable Light',
          'Color Temperature Light',
          'Extended Color Light',
          // Chapter 5. Smart plugs/Outlets and other Actuators device types
          'OnOff Plugin Unit',
          'Dimmable PlugIn Unit',
          'Mounted OnOff Control',
          'Mounted Dimmable Load Control',
          'Pump',
          'Water Valve',
          'Irrigation System',
        ],
        clusters: {},
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID all-types/));
    });

    it('should create a Power Source device with replaceable battery cluster', () => {
      platform.createrDevice('ps-replaceable', 'root', {
        deviceTypes: ['Power Source'],
        clusters: { PowerSource: { batReplacementDescription: 'AAA', batQuantity: 3, batPercentRemaining: 200, batChargeLevel: 0 } },
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Created Power Source Replaceable Battery Cluster/));
    });

    it('should create a Power Source device with rechargeable battery cluster', () => {
      platform.createrDevice('ps-rechargeable', 'root', {
        deviceTypes: ['Power Source'],
        clusters: { PowerSource: { batChargeState: 0, batFunctionalWhileCharging: true } },
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Created Power Source Rechargeable Battery Cluster/));
    });

    it('should create a Power Source device with battery cluster', () => {
      platform.createrDevice('ps-battery', 'root', {
        deviceTypes: ['Power Source'],
        clusters: { PowerSource: { batChargeLevel: 0 } },
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Created Power Source Battery Cluster/));
    });

    it('should create a Power Source device with wired cluster', () => {
      platform.createrDevice('ps-wired', 'root', {
        deviceTypes: ['Power Source'],
        clusters: { PowerSource: { wiredCurrentType: 0 } },
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Created Power Source Wired Cluster/));
    });

    it('should create a Soil Sensor device', () => {
      platform.createrDevice('soil1', 'root', {
        deviceTypes: ['Soil Sensor'],
        clusters: {},
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Creating device with ID soil1/));
    });
  });

  describe('onConfigure', () => {
    beforeEach(() => {
      platform.state.clear();
    });

    it('should log info when state is empty', async () => {
      await platform.onConfigure();
      expect(loggerInfoSpy).toHaveBeenCalledWith('onConfigure called');
    });

    it('should warn when state topic does not match expected format', async () => {
      platform.state.set('invalid-topic', JSON.stringify({ OnOff: { onOff: true } }));
      await platform.onConfigure();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/does not match expected format/));
    });

    it('should warn when device is not registered', async () => {
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore accessing inherited method for testing
      const getDeviceByIdSpy = jest.spyOn(platform, 'getDeviceById').mockImplementation(() => null);
      platform.state.set(`${config.topic}/unknownDevice/state/root`, JSON.stringify({ OnOff: { onOff: true } }));
      await platform.onConfigure();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/is not registered/));
      getDeviceByIdSpy.mockRestore();
    });

    it('should skip setCluster for non-root endpoint', async () => {
      const mockSetCluster = jest.fn().mockImplementation(async () => {});
      const mockDevice = { log: { debug: jest.fn(), warn: jest.fn() }, hasClusterServer: jest.fn().mockReturnValue(true), setCluster: mockSetCluster };
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore accessing inherited method for testing
      const getDeviceByIdSpy = jest.spyOn(platform, 'getDeviceById').mockReturnValue(mockDevice);
      platform.state.set(`${config.topic}/light1/state/sensor`, JSON.stringify({ OnOff: { onOff: true } }));
      await platform.onConfigure();
      expect(mockSetCluster).not.toHaveBeenCalled();
      getDeviceByIdSpy.mockRestore();
    });

    it('should warn on device log when cluster is not on device', async () => {
      const mockWarn = jest.fn();
      const mockSetCluster = jest.fn().mockImplementation(async () => {});
      const mockDevice = { log: { debug: jest.fn(), warn: mockWarn }, hasClusterServer: jest.fn().mockReturnValue(false), setCluster: mockSetCluster };
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore accessing inherited method for testing
      const getDeviceByIdSpy = jest.spyOn(platform, 'getDeviceById').mockReturnValue(mockDevice);
      platform.state.set(`${config.topic}/light1/state/root`, JSON.stringify({ UnknownCluster: { attr: true } }));
      await platform.onConfigure();
      expect(mockWarn).toHaveBeenCalledWith(expect.stringMatching(/does not have cluster/));
      expect(mockSetCluster).not.toHaveBeenCalled();
      getDeviceByIdSpy.mockRestore();
    });

    it('should call setCluster for registered device with root endpoint and known cluster', async () => {
      const mockSetCluster = jest.fn().mockImplementation(async () => {});
      const mockDebug = jest.fn();
      const mockDevice = { log: { debug: mockDebug, warn: jest.fn() }, hasClusterServer: jest.fn().mockReturnValue(true), setCluster: mockSetCluster };
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore accessing inherited method for testing
      const getDeviceByIdSpy = jest.spyOn(platform, 'getDeviceById').mockReturnValue(mockDevice);
      platform.state.set(`${config.topic}/light1/state/root`, JSON.stringify({ OnOff: { onOff: false } }));
      await platform.onConfigure();
      expect(mockDebug).toHaveBeenCalledWith(expect.stringMatching(/Setting cluster 'OnOff'/));
      expect(mockDevice.hasClusterServer).toHaveBeenCalledWith('OnOff');
      expect(mockSetCluster).toHaveBeenCalledWith('OnOff', { onOff: false }, expect.anything());
      getDeviceByIdSpy.mockRestore();
    });

    it('should skip unknown clusters and call setCluster only for present ones', async () => {
      const mockSetCluster = jest.fn().mockImplementation(async () => {});
      const mockWarn = jest.fn();
      const mockDevice = {
        log: { debug: jest.fn(), warn: mockWarn },
        hasClusterServer: jest.fn().mockImplementation((cluster: unknown) => cluster === 'OnOff'),
        setCluster: mockSetCluster,
      };
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-ignore accessing inherited method for testing
      const getDeviceByIdSpy = jest.spyOn(platform, 'getDeviceById').mockReturnValue(mockDevice);
      platform.state.set(`${config.topic}/light1/state/root`, JSON.stringify({ OnOff: { onOff: true }, UnknownCluster: { attr: 1 } }));
      await platform.onConfigure();
      expect(mockSetCluster).toHaveBeenCalledTimes(1);
      expect(mockSetCluster).toHaveBeenCalledWith('OnOff', { onOff: true }, expect.anything());
      expect(mockWarn).toHaveBeenCalledWith(expect.stringMatching(/does not have cluster/));
      getDeviceByIdSpy.mockRestore();
    });
  });
});
