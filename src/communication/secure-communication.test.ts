import {
  SecureCommunicationFramework,
  SecureChannel,
  SecureMessage,
  EncryptedPayload,
  DeliveryReceipt
} from './index';
import { AgentRegistry } from '../agent-registry/index';

describe('Secure Communication Framework', () => {
  let registry: AgentRegistry;
  let communication: SecureCommunicationFramework;

  beforeEach(() => {
    registry = new AgentRegistry();
    communication = new SecureCommunicationFramework(registry);
  });

  afterEach(() => {
    communication.destroy();
    registry.destroy();
  });

  describe('Channel Establishment', () => {
    beforeEach(() => {
      // Register test agents
      registry.registerAgent('agent1', [], [], {
        name: 'Agent 1',
        description: 'Test agent 1',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });

      registry.registerAgent('agent2', [], [], {
        name: 'Agent 2',
        description: 'Test agent 2',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8,
        totalTasks: 50,
        successRate: 0.9
      });
    });

    it('should establish secure channel with peer', async () => {
      const channel = await communication.establishConnection('agent1');

      expect(channel.peerId).toBe('agent1');
      expect(channel.encryptionKey).toBeInstanceOf(Buffer);
      expect(channel.protocolVersion).toBe('1.0');
      expect(channel.authenticated).toBe(true);
      expect(channel.messageQueue).toEqual([]);
    });

    it('should reuse existing channel', async () => {
      const channel1 = await communication.establishConnection('agent1');
      const channel2 = await communication.establishConnection('agent1');

      expect(channel1).toBe(channel2);
    });

    it('should fail to establish channel with unknown peer', async () => {
      await expect(communication.establishConnection('unknown-agent'))
        .rejects.toThrow('Peer agent unknown-agent not found in registry');
    });
  });

  describe('Message Encryption and Signing', () => {
    let channel: SecureChannel;

    beforeEach(async () => {
      registry.registerAgent('sender', [], [], {
        name: 'Sender Agent',
        description: 'Test sender',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });

      registry.registerAgent('receiver', [], [], {
        name: 'Receiver Agent',
        description: 'Test receiver',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8,
        totalTasks: 50,
        successRate: 0.9
      });

      channel = await communication.establishConnection('receiver');
    });

    it('should encrypt and sign messages', async () => {
      const message: SecureMessage = {
        id: 'msg-1',
        senderId: 'sender',
        recipientId: 'receiver',
        payload: { type: 'test', data: 'hello world' },
        timestamp: new Date(),
        ttl: 300000
      };

      // Mock the deliverMessage to avoid network simulation
      const originalDeliver = communication['deliverMessage'];
      communication['deliverMessage'] = jest.fn().mockResolvedValue(undefined);

      const receipt = await communication.sendMessage(message);

      expect(receipt.delivered).toBe(true);
      expect(receipt.messageId).toBe('msg-1');
      expect(receipt.timestamp).toBeInstanceOf(Date);

      // Restore original method
      communication['deliverMessage'] = originalDeliver;
    });

    it('should decrypt received messages', async () => {
      // Test the encryption/decryption functions directly
      const testPayload = { type: 'test', data: 'hello world' };
      const encrypted = await communication['encryptMessage'](testPayload, channel.encryptionKey);
      const decrypted = await communication['decryptMessage'](encrypted, channel.encryptionKey);

      expect(decrypted).toEqual(testPayload);
    });

    it('should verify message signatures', async () => {
      // Test signing/verification directly
      const testPayload = { type: 'test', data: 'signed content' };
      
      // First establish a channel to get encryption key
      const channel = await communication.establishConnection('receiver');
      
      // Encrypt the payload first (as done in sendMessage)
      const encryptedPayload = await communication['encryptMessage'](testPayload, channel.encryptionKey);
      
      // Sign the encrypted payload
      const signature = communication['signMessage'](encryptedPayload, communication['getPrivateKey']('sender'));

      // Create a mock message with encrypted payload and signature
      const mockMessage: SecureMessage = {
        id: 'test',
        senderId: 'sender',
        recipientId: 'receiver',
        payload: encryptedPayload,
        timestamp: new Date(),
        ttl: 300000,
        signature
      };

      const isValid = communication['verifySignature'](mockMessage);
      expect(isValid).toBe(true);
    });
  });

  describe('Broadcast Messaging', () => {
    beforeEach(() => {
      // Register multiple agents
      for (let i = 1; i <= 5; i++) {
        registry.registerAgent(`agent${i}`, [], [], {
          name: `Agent ${i}`,
          description: `Test agent ${i}`,
          version: '1.0',
          author: 'Test',
          license: 'MIT',
          tags: [],
          reputation: 0.8,
          totalTasks: 50,
          successRate: 0.9
        });
      }
    });

    it('should broadcast message to multiple recipients', async () => {
      const message: SecureMessage = {
        id: 'broadcast-1',
        senderId: 'agent1',
        recipientId: 'agent2', // Will be overridden for each recipient
        payload: { type: 'broadcast', data: 'hello all' },
        timestamp: new Date(),
        ttl: 300000
      };

      const recipients = ['agent2', 'agent3', 'agent4'];
      await communication.broadcastMessage(message, recipients);

      // Check that channels were established
      const metrics = communication.getMetrics();
      expect(metrics.activeChannels).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Protocol Negotiation', () => {
    beforeEach(() => {
      registry.registerAgent('agent1', [], [], {
        name: 'Agent 1',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });
    });

    it('should negotiate protocol version', async () => {
      const version = await communication.negotiateProtocol('agent1');
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should fail negotiation with unknown peer', async () => {
      await expect(communication.negotiateProtocol('unknown'))
        .rejects.toThrow('Peer agent unknown not found');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      registry.registerAgent('agent1', [], [], {
        name: 'Agent 1',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });

      registry.registerAgent('agent2', [], [], {
        name: 'Agent 2',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8,
        totalTasks: 50,
        successRate: 0.9
      });

      await communication.establishConnection('agent1');
      await communication.establishConnection('agent2');
    });

    it('should track communication metrics', async () => {
      const message: SecureMessage = {
        id: 'metrics-test',
        senderId: 'agent1',
        recipientId: 'agent2',
        payload: { type: 'test', data: 'metrics check' },
        timestamp: new Date(),
        ttl: 300000
      };

      // Mock deliverMessage
      const originalDeliver = communication['deliverMessage'];
      communication['deliverMessage'] = jest.fn().mockResolvedValue(undefined);

      await communication.sendMessage(message);

      const metrics = communication.getMetrics();
      expect(metrics.messagesSent).toBe(1);
      expect(metrics.activeChannels).toBe(2);
      expect(metrics.bytesTransferred).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);

      // Restore
      communication['deliverMessage'] = originalDeliver;
    });

    it('should track failed deliveries', async () => {
      // Try to send to non-existent agent
      const message: SecureMessage = {
        id: 'fail-test',
        senderId: 'agent1',
        recipientId: 'nonexistent',
        payload: { type: 'test' },
        timestamp: new Date(),
        ttl: 300000
      };

      const receipt = await communication.sendMessage(message);
      expect(receipt.delivered).toBe(false);

      const metrics = communication.getMetrics();
      expect(metrics.failedDeliveries).toBe(1);
    });
  });

  describe('Channel Management', () => {
    beforeEach(async () => {
      registry.registerAgent('agent1', [], [], {
        name: 'Agent 1',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });

      await communication.establishConnection('agent1');
    });

    it('should close channels', () => {
      const metricsBefore = communication.getMetrics();
      expect(metricsBefore.activeChannels).toBe(1);

      communication.closeChannel('agent1');

      const metricsAfter = communication.getMetrics();
      expect(metricsAfter.activeChannels).toBe(0);
    });

    it('should handle channel timeouts', (done) => {
      // Create communication framework with short timeout for testing
      const testCommunication = new SecureCommunicationFramework(registry, 100);

      testCommunication.establishConnection('agent1').then(() => {
        // Wait for timeout (300ms = 3 intervals)
        setTimeout(() => {
          const metrics = testCommunication.getMetrics();
          expect(metrics.activeChannels).toBe(0);
          testCommunication.destroy();
          done();
        }, 350);
      });
    });
  });

  describe('Security Features', () => {
    let channel: SecureChannel;

    beforeEach(async () => {
      registry.registerAgent('alice', [], [], {
        name: 'Alice',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.95
      });

      registry.registerAgent('bob', [], [], {
        name: 'Bob',
        description: 'Test agent',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8,
        totalTasks: 50,
        successRate: 0.9
      });

      channel = await communication.establishConnection('bob');
    });

    it('should use different encryption keys for different channels', async () => {
      const channel2 = await communication.establishConnection('alice');

      // Keys should be different for different peers
      expect(channel.encryptionKey.equals(channel2.encryptionKey)).toBe(false);
    });

    it('should maintain message integrity', async () => {
      const message: SecureMessage = {
        id: 'integrity-test',
        senderId: 'alice',
        recipientId: 'bob',
        payload: { type: 'integrity', data: 'original content' },
        timestamp: new Date(),
        ttl: 300000
      };

      // Manually encrypt and sign the message
      const encryptedPayload = await communication['encryptMessage'](message.payload, channel.encryptionKey);
      const signature = communication['signMessage'](encryptedPayload, communication['getPrivateKey']('alice'));

      const encryptedMessage: SecureMessage = {
        ...message,
        payload: encryptedPayload,
        signature
      };

      // Tamper with encrypted payload
      if (encryptedMessage.payload && typeof encryptedMessage.payload === 'object' && 'ciphertext' in encryptedMessage.payload) {
        (encryptedMessage.payload as any).ciphertext = Buffer.from('tampered');
      }

      await expect(communication.receiveMessage(encryptedMessage))
        .rejects.toThrow();
    });
  });
});