const NAME = 'MqttService';

import { loggerDebugSpy, loggerErrorSpy, loggerWarnSpy, setupTest } from 'matterbridge/vitest-utils';
import type { IPublishPacket } from 'mqtt';

import type { MqttPlatformConfig } from '../src/module.js';
import type { MqttService as MqttServiceType } from '../src/mqtt.js';

// --- Mock infrastructure (hoisted so vi.mock factories can reference it) ---

const { mockEndAsync, mockSubscribeAsync, mockPublishAsync, mockOn, mockMqttClient, mockConnect, mockReadFileSync } = vi.hoisted(() => {
  const mockEndAsync = vi.fn<() => Promise<void>>();
  const mockSubscribeAsync = vi.fn<(topic: string, opts?: Record<string, unknown>) => Promise<unknown>>();
  const mockPublishAsync = vi.fn<() => Promise<void>>();
  const mockOn = vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>();

  const mockMqttClient = {
    connected: false,
    on: mockOn,
    subscribeAsync: mockSubscribeAsync,
    publishAsync: mockPublishAsync,
    endAsync: mockEndAsync,
  };

  const mockConnect = vi.fn<(host: string, opts?: Record<string, unknown>) => Promise<typeof mockMqttClient>>();
  const mockReadFileSync = vi.fn<() => Buffer>();

  return { mockEndAsync, mockSubscribeAsync, mockPublishAsync, mockOn, mockMqttClient, mockConnect, mockReadFileSync };
});

vi.mock('mqtt', () => ({
  connectAsync: mockConnect,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: mockReadFileSync };
});

// --- SUT: imported dynamically so the mocks above are applied ---

let MqttService: typeof MqttServiceType;

// --- Test data ---

// node:fs is mocked above for the SUT's certificate reads, so load the config with the real fs.
const { readFileSync } = await vi.importActual<typeof import('node:fs')>('node:fs');

const defaultConfig: MqttPlatformConfig = JSON.parse(readFileSync('matterbridge-mqtt.config.json', 'utf-8'));
const baseConfig: MqttPlatformConfig = {
  ...defaultConfig,
  debug: false,
};

/**
 * Creates a minimal MQTT publish packet for message event tests.
 *
 * @param {boolean} retain Whether the packet should be marked as retained.
 * @param {string} topic The MQTT topic carried by the packet.
 * @param {Buffer | string} payload The MQTT payload carried by the packet.
 * @returns {IPublishPacket} A publish packet suitable for MqttService message event tests.
 */
function createPublishPacket(retain: boolean, topic = 'matterbridge/device1', payload: Buffer | string = Buffer.from('{"state":"ON"}')): IPublishPacket {
  return { cmd: 'publish', dup: false, qos: 0, retain, topic, payload };
}

/**
 * Creates a fresh MqttService, merging config overrides over baseConfig.
 *
 * @param {Partial<MqttPlatformConfig>} [overrides] Optional config overrides merged over baseConfig.
 * @returns {InstanceType<typeof MqttService>} A new MqttService instance.
 */
function createService(overrides: Partial<MqttPlatformConfig> = {}): InstanceType<typeof MqttService> {
  return new MqttService({ ...baseConfig, ...overrides });
}

/**
 * Starts a service connection and awaits it.
 *
 * @param {InstanceType<typeof MqttService>} service The service instance to connect.
 * @returns {Promise<void>} Resolves when the service is connected.
 */
async function connectService(service: InstanceType<typeof MqttService>): Promise<void> {
  await service.connect();
}

/** Handlers captured from calls to mockMqttClient.on — keyed by event name. */
let handlers: Record<string, (...args: unknown[]) => void>;

// ---------------------------------------------------------------------------

await setupTest(NAME, false);

describe('MqttService', () => {
  beforeAll(async () => {
    ({ MqttService } = await import('../src/mqtt.js'));
  });

  beforeEach(() => {
    mockMqttClient.connected = false;
    handlers = {};

    // Register default mock implementations (preserved between tests by clearAllMocks)
    mockConnect.mockResolvedValue(mockMqttClient);
    mockEndAsync.mockResolvedValue();
    mockReadFileSync.mockReturnValue(Buffer.from('file-content'));
    mockSubscribeAsync.mockResolvedValue([]);
    mockPublishAsync.mockResolvedValue();
    mockOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    });
  });

  afterEach(() => {
    // Clear call history only; keep the logger spy implementations installed by setupTest intact
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create an instance with the given config and log', () => {
      expect(createService()).toBeInstanceOf(MqttService);
    });
  });

  // -------------------------------------------------------------------------
  // buildClientOptions (private — exercised via connect)
  // -------------------------------------------------------------------------

  describe('buildClientOptions', () => {
    it('should pass port, protocolVersion, and rejectUnauthorized to mqtt.connect', async () => {
      await connectService(createService());
      expect(mockConnect).toHaveBeenCalledWith('mqtt://localhost', expect.objectContaining({ port: 1883, protocolVersion: 5, rejectUnauthorized: true }));
    });

    it('should not include clientId when the config value is empty', async () => {
      await connectService(createService({ clientId: '' }));
      const opts = mockConnect.mock.calls[0][1];
      expect(opts).not.toHaveProperty('clientId');
    });

    it('should include clientId when set', async () => {
      await connectService(createService({ clientId: 'my-client' }));
      expect(mockConnect).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ clientId: 'my-client' }));
    });

    it('should not include username or password when the config values are empty', async () => {
      await connectService(createService({ username: '', password: '' }));
      const opts = mockConnect.mock.calls[0][1];
      expect(opts).not.toHaveProperty('username');
      expect(opts).not.toHaveProperty('password');
    });

    it('should include username and password when both are set', async () => {
      await connectService(createService({ username: 'user', password: 'pass' }));
      expect(mockConnect).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ username: 'user', password: 'pass' }));
    });

    it('should read the CA certificate file when ca path is set', async () => {
      await connectService(createService({ ca: '/path/to/ca.pem' }));
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/ca.pem');
    });

    it('should throw a descriptive error when the CA certificate file cannot be read', async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      await expect(createService({ ca: '/bad/ca.pem' }).connect()).rejects.toThrow("MqttService: failed to read CA certificate '/bad/ca.pem'");
    });

    it('should read the client certificate file when cert path is set', async () => {
      await connectService(createService({ cert: '/path/to/cert.pem' }));
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/cert.pem');
    });

    it('should throw a descriptive error when the client certificate file cannot be read', async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      await expect(createService({ cert: '/bad/cert.pem' }).connect()).rejects.toThrow("MqttService: failed to read client certificate '/bad/cert.pem'");
    });

    it('should read the client private key file when key path is set', async () => {
      await connectService(createService({ key: '/path/to/key.pem' }));
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/key.pem');
    });

    it('should throw a descriptive error when the client private key file cannot be read', async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      await expect(createService({ key: '/bad/key.pem' }).connect()).rejects.toThrow("MqttService: failed to read client private key '/bad/key.pem'");
    });
  });

  // -------------------------------------------------------------------------
  // connect
  // -------------------------------------------------------------------------

  describe('connect', () => {
    it('should call mqtt.connect with the configured host and options', async () => {
      await connectService(createService());
      expect(mockConnect).toHaveBeenCalledWith('mqtt://localhost', expect.objectContaining({ port: 1883 }));
    });

    it('should be a no-op when the client is already connected', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should resolve the returned Promise when the broker connects', async () => {
      await expect(createService().connect()).resolves.toBe(true);
    });

    it('should resolve the returned Promise when connectAsync fails', async () => {
      mockConnect.mockRejectedValueOnce(new Error('connection refused'));
      await expect(createService().connect()).resolves.toBe(false);
    });

    it('should log an error when connectAsync fails', async () => {
      mockConnect.mockRejectedValueOnce(new Error('connection refused'));
      await createService().connect();
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
    });

    it('should emit "connect" when the underlying client fires a connect event', async () => {
      const service = createService();
      await connectService(service);
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('connect', listener);
      handlers['connect']();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should emit "close" when the underlying client fires a close event', async () => {
      const service = createService();
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('close', listener);
      await connectService(service);
      handlers['close']();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should emit "reconnect" when the underlying client fires a reconnect event', async () => {
      const service = createService();
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('reconnect', listener);
      await connectService(service);
      handlers['reconnect']();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should emit "error" carrying the original Error when the underlying client fires an error event', async () => {
      const service = createService();
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('error', listener);
      await connectService(service);
      const err = new Error('connection refused');
      handlers['error'](err);
      expect(listener).toHaveBeenCalledWith(err);
    });

    it('should emit "message" with topic and UTF-8 string payload when the underlying client fires a message event', async () => {
      const service = createService();
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('message', listener);
      await connectService(service);
      const packet = createPublishPacket(false);
      handlers['message']('matterbridge/device1', Buffer.from('{"state":"ON"}'), packet);
      expect(listener).toHaveBeenCalledWith('matterbridge/device1', '{"state":"ON"}', packet);
    });

    it('should log retained messages when the underlying client marks a packet as retained', async () => {
      await connectService(createService());
      handlers['message']('matterbridge/device1', Buffer.from('{"state":"ON"}'), createPublishPacket(true));
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/retained message on.*matterbridge\/device1/));
    });
  });

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  describe('close', () => {
    it('should resolve immediately without calling endAsync when no client exists', async () => {
      await expect(createService().close()).resolves.toBe(true);
      expect(mockEndAsync).not.toHaveBeenCalled();
    });

    it('should call endAsync and clear the internal client reference', async () => {
      const service = createService();
      await connectService(service);
      expect(await service.close()).toBe(true);
      expect(mockEndAsync).toHaveBeenCalledTimes(1);
      // After close, this.client is undefined → subscribe must warn
      await service.subscribe('any/topic');
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should log error and resolve when endAsync rejects', async () => {
      mockEndAsync.mockRejectedValueOnce(new Error('close failed'));
      const service = createService();
      await connectService(service);
      await expect(service.close()).resolves.toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('close failed'));
    });
  });

  // -------------------------------------------------------------------------
  // subscribe
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('should log a warning and skip when not connected', async () => {
      await expect(createService().subscribe('test/topic')).resolves.toBe(false);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/cannot subscribe to.*test\/topic/));
      expect(mockSubscribeAsync).not.toHaveBeenCalled();
    });

    it('should call subscribeAsync with retained replay enabled when connected with MQTT 5', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.subscribe('test/topic');
      expect(mockSubscribeAsync).toHaveBeenCalledWith('test/topic', { qos: 2, rh: 0 });
    });

    it('should call subscribeAsync without MQTT 5 retain handling when connected with MQTT 3.1.1', async () => {
      const service = createService({ protocolVersion: 4 });
      await connectService(service);
      mockMqttClient.connected = true;
      await service.subscribe('test/topic');
      expect(mockSubscribeAsync).toHaveBeenCalledWith('test/topic', { qos: 2 });
    });

    it('should log debug when subscribeAsync resolves', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.subscribe('test/topic');
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/subscribed to.*test\/topic/));
    });

    it('should emit "subscribed" when subscribeAsync resolves', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('subscribed', listener);
      expect(await service.subscribe('test/topic')).toBe(true);
      expect(listener).toHaveBeenCalledWith('test/topic');
    });

    it('should log error when subscribeAsync rejects', async () => {
      mockSubscribeAsync.mockRejectedValueOnce(new Error('subscribe failed'));
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      expect(await service.subscribe('test/topic')).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/subscribe error on.*test\/topic/));
    });
  });

  // -------------------------------------------------------------------------
  // publish
  // -------------------------------------------------------------------------

  describe('publish', () => {
    it('should log a warning and skip when not connected', async () => {
      await expect(createService().publish('test/topic', 'payload')).resolves.toBe(false);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/cannot publish to.*test\/topic/));
      expect(mockPublishAsync).not.toHaveBeenCalled();
    });

    it('should call publishAsync with topic and payload when no options are provided', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.publish('test/topic', 'payload');
      expect(mockPublishAsync).toHaveBeenCalledWith('test/topic', 'payload', undefined);
    });

    it('should forward provided publish options to publishAsync', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.publish('test/topic', 'payload', { retain: true, qos: 1 });
      expect(mockPublishAsync).toHaveBeenCalledWith('test/topic', 'payload', { retain: true, qos: 1 });
    });

    it('should log debug when publishAsync resolves', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      await service.publish('test/topic', 'payload');
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/published to.*test\/topic/));
    });

    it('should emit "published" when publishAsync resolves', async () => {
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      const listener = vi.fn<(...args: unknown[]) => void>();
      service.on('published', listener);
      expect(await service.publish('test/topic', 'payload')).toBe(true);
      expect(listener).toHaveBeenCalledWith('test/topic', 'payload');
    });

    it('should log error when publishAsync rejects', async () => {
      mockPublishAsync.mockRejectedValueOnce(new Error('publish failed'));
      const service = createService();
      await connectService(service);
      mockMqttClient.connected = true;
      expect(await service.publish('test/topic', 'payload')).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/publish error on.*test\/topic/));
    });
  });
});
