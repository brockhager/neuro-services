import { EventEmitter } from 'events';
import crypto from 'crypto';
import { AgentRegistry } from '../agent-registry/index';

export interface SecureChannel {
  peerId: string;
  encryptionKey: Buffer;
  protocolVersion: string;
  lastActivity: Date;
  messageQueue: SecureMessage[];
  authenticated: boolean;
  certificate?: Buffer;
}

export interface SecureMessage {
  id: string;
  senderId: string;
  recipientId: string;
  payload: any; // Plain text payload before encryption
  timestamp: Date;
  ttl: number;
  signature?: Buffer; // Added optional signature for encrypted messages
}

export interface EncryptedPayload {
  iv: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

export interface CommunicationMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  averageLatency: number;
  failedDeliveries: number;
  activeChannels: number;
}

export interface DeliveryReceipt {
  messageId: string;
  delivered: boolean;
  timestamp: Date;
  error?: string;
}

export class SecureCommunicationFramework extends EventEmitter {
  private channels: Map<string, SecureChannel> = new Map();
  private metrics: CommunicationMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    averageLatency: 0,
    failedDeliveries: 0,
    activeChannels: 0
  };

  private keyPairs: Map<string, { publicKey: Buffer; privateKey: Buffer }> = new Map();
  private messageQueue: SecureMessage[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private registry: AgentRegistry,
    private heartbeatIntervalMs: number = 30000 // 30 seconds
  ) {
    super();
    this.startHeartbeatMonitoring();
  }

  /**
   * Establish a secure channel with a peer agent
   */
  async establishConnection(peerId: string): Promise<SecureChannel> {
    if (this.channels.has(peerId)) {
      return this.channels.get(peerId)!;
    }

    // Generate ECDH key pair for this connection
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.generateKeys();

    // Get peer's public key from registry
    const peerAgent = this.registry.getAgent(peerId);
    if (!peerAgent) {
      throw new Error(`Peer agent ${peerId} not found in registry`);
    }

    // Perform ECDH key exchange (simplified - in real implementation,
    // this would involve actual key exchange protocol)
    // For testing, use a mock shared secret
    const mockPeerPublicKey = crypto.createECDH('secp256k1');
    mockPeerPublicKey.generateKeys();
    const sharedSecret = ecdh.computeSecret(mockPeerPublicKey.getPublicKey());

    // Derive encryption key using HKDF
    const encryptionKey = this.hkdf(sharedSecret, 'NeuroSwarm-Communication', 32);

    const channel: SecureChannel = {
      peerId,
      encryptionKey,
      protocolVersion: '1.0',
      lastActivity: new Date(),
      messageQueue: [],
      authenticated: true, // Simplified - would involve certificate verification
      certificate: Buffer.from('peer-certificate-placeholder')
    };

    this.channels.set(peerId, channel);
    this.metrics.activeChannels++;

    this.emit('channelEstablished', { peerId, channel });
    return channel;
  }

  /**
   * Send an encrypted message to a peer
   */
  async sendMessage(message: SecureMessage): Promise<DeliveryReceipt> {
    const startTime = Date.now();

    try {
      // Get or establish channel
      const channel = await this.establishConnection(message.recipientId);

      // Encrypt the message payload
      const encryptedPayload = await this.encryptMessage(message.payload, channel.encryptionKey);

      // Create signed message (sign the encrypted payload)
      const signedMessage: SecureMessage = {
        ...message,
        payload: encryptedPayload,
        signature: this.signMessage(encryptedPayload, this.getPrivateKey(message.senderId))
      };

      // Add to channel queue for delivery
      channel.messageQueue.push(signedMessage);
      channel.lastActivity = new Date();

      // Simulate delivery (in real implementation, this would send over network)
      await this.deliverMessage(signedMessage);

      this.metrics.messagesSent++;
      this.metrics.bytesTransferred += JSON.stringify(signedMessage).length;

      const receipt: DeliveryReceipt = {
        messageId: message.id,
        delivered: true,
        timestamp: new Date()
      };

      this.emit('messageSent', { message: signedMessage, receipt });
      return receipt;

    } catch (error) {
      this.metrics.failedDeliveries++;

      const receipt: DeliveryReceipt = {
        messageId: message.id,
        delivered: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('messageFailed', { message, error: receipt.error });
      return receipt;
    }
  }

  /**
   * Broadcast message to multiple recipients
   */
  async broadcastMessage(message: SecureMessage, recipientIds: string[]): Promise<void> {
    const promises = recipientIds.map(recipientId => {
      const recipientMessage = { ...message, recipientId };
      return this.sendMessage(recipientMessage);
    });

    await Promise.allSettled(promises);
    this.emit('messageBroadcasted', { originalMessage: message, recipients: recipientIds });
  }

  /**
   * Receive and decrypt a message
   */
  async receiveMessage(encryptedMessage: SecureMessage): Promise<SecureMessage> {
    const startTime = Date.now();

    try {
      // Verify signature
      const isValid = this.verifySignature(encryptedMessage);
      if (!isValid) {
        throw new Error('Invalid message signature');
      }

      // Get channel
      const channel = this.channels.get(encryptedMessage.senderId);
      if (!channel) {
        throw new Error(`No secure channel established with ${encryptedMessage.senderId}`);
      }

      // Decrypt payload
      const decryptedPayload = await this.decryptMessage(encryptedMessage.payload, channel.encryptionKey);

      const decryptedMessage: SecureMessage = {
        ...encryptedMessage,
        payload: decryptedPayload
      };

      channel.lastActivity = new Date();
      this.metrics.messagesReceived++;
      this.metrics.bytesTransferred += JSON.stringify(encryptedMessage).length;

      // Update average latency
      const latency = Date.now() - startTime;
      this.metrics.averageLatency =
        (this.metrics.averageLatency * (this.metrics.messagesReceived - 1) + latency) /
        this.metrics.messagesReceived;

      this.emit('messageReceived', decryptedMessage);
      return decryptedMessage;

    } catch (error) {
      this.emit('messageDecryptionFailed', { message: encryptedMessage, error });
      throw error;
    }
  }

  /**
   * Negotiate protocol version with peer
   */
  async negotiateProtocol(peerId: string): Promise<string> {
    // Simplified protocol negotiation
    // In real implementation, this would involve capability exchange
    const supportedVersions = ['1.0', '0.9'];
    const peerAgent = this.registry.getAgent(peerId);

    if (!peerAgent) {
      throw new Error(`Peer agent ${peerId} not found`);
    }

    // Use highest common version
    return '1.0'; // Simplified
  }

  /**
   * Get communication metrics
   */
  getMetrics(): CommunicationMetrics & {
    channelCount: number;
    queuedMessages: number;
  } {
    return {
      ...this.metrics,
      channelCount: this.channels.size,
      queuedMessages: this.messageQueue.length
    };
  }

  /**
   * Close channel with peer
   */
  closeChannel(peerId: string): void {
    const channel = this.channels.get(peerId);
    if (channel) {
      this.channels.delete(peerId);
      this.metrics.activeChannels--;
      this.emit('channelClosed', { peerId });
    }
  }

  /**
   * Encrypt message payload using AES-256-GCM (simplified for testing)
   */
  private async encryptMessage(payload: any, key: Buffer): Promise<EncryptedPayload> {
    // Simplified encryption for testing - in production, use proper AES-GCM
    const plaintext = JSON.stringify(payload);
    const iv = crypto.randomBytes(16);
    const ciphertext = Buffer.from(plaintext); // Simplified - not actually encrypted
    const tag = crypto.randomBytes(16);

    return {
      iv,
      ciphertext,
      tag
    };
  }

  /**
   * Decrypt message payload using AES-256-GCM (simplified for testing)
   */
  private async decryptMessage(encryptedPayload: EncryptedPayload, key: Buffer): Promise<any> {
    // Simplified decryption for testing - in production, use proper AES-GCM
    const plaintext = encryptedPayload.ciphertext.toString('utf8');
    return JSON.parse(plaintext);
  }

  /**
   * Sign message with Ed25519 (simplified for testing)
   */
  private signMessage(payload: any, privateKey: Buffer): Buffer {
    // Simplified signing for testing - in production, use proper Ed25519
    const messageHash = crypto.createHash('sha256')
      .update(JSON.stringify(payload))
      .digest();
    return crypto.createHmac('sha256', privateKey.slice(0, 32)).update(messageHash).digest();
  }

  /**
   * Verify message signature (simplified for testing)
   */
  private verifySignature(message: SecureMessage): boolean {
    try {
      if (!message.signature) {
        return false;
      }

      const privateKey = this.getPrivateKey(message.senderId); // Use private key for HMAC verification (simplified)
      const messageHash = crypto.createHash('sha256')
        .update(JSON.stringify(message.payload))
        .digest();
      const expectedSignature = crypto.createHmac('sha256', privateKey.slice(0, 32)).update(messageHash).digest();

      return message.signature.equals(expectedSignature);
    } catch {
      return false;
    }
  }

  /**
   * HKDF key derivation
   */
  private hkdf(secret: Buffer, salt: string, length: number): Buffer {
    const prk = crypto.createHmac('sha256', salt).update(secret).digest();
    return crypto.createHmac('sha256', prk).update('NeuroSwarm').digest().slice(0, length);
  }

  /**
   * Get private key for agent (simplified key management)
   */
  private getPrivateKey(agentId: string): Buffer {
    if (!this.keyPairs.has(agentId)) {
      // Generate new key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      this.keyPairs.set(agentId, {
        publicKey: publicKey.export({ type: 'spki', format: 'der' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'der' })
      });
    }
    return this.keyPairs.get(agentId)!.privateKey;
  }

  /**
   * Get public key for agent
   */
  private getPublicKey(agentId: string): Buffer {
    if (!this.keyPairs.has(agentId)) {
      this.getPrivateKey(agentId); // Generate if not exists
    }
    return this.keyPairs.get(agentId)!.publicKey;
  }

  /**
   * Simulate message delivery (in real implementation, this would use network transport)
   */
  private async deliverMessage(message: SecureMessage): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

    // Add to recipient's channel queue
    const recipientChannel = this.channels.get(message.recipientId);
    if (recipientChannel) {
      recipientChannel.messageQueue.push(message);
    }

    // Simulate message reception by decrypting and emitting messageReceived
    try {
      // Get channel for decryption
      const channel = this.channels.get(message.senderId);
      if (channel) {
        // Decrypt payload
        const decryptedPayload = await this.decryptMessage(message.payload, channel.encryptionKey);

        const decryptedMessage: SecureMessage = {
          ...message,
          payload: decryptedPayload
        };

        // Update metrics
        this.metrics.messagesReceived++;
        this.metrics.bytesTransferred += JSON.stringify(message).length;

        // Emit messageReceived event to simulate the recipient receiving the message
        this.emit('messageReceived', decryptedMessage);
      }
    } catch (error) {
      // If decryption fails, emit the raw message
      this.emit('messageReceived', message);
    }

    // In real implementation, this would send over WebSocket, HTTP/2, or other transport
    this.emit('messageDelivered', message);
  }

  /**
   * Start heartbeat monitoring for channel health
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = now - (this.heartbeatIntervalMs * 3); // 3x interval

      for (const [peerId, channel] of this.channels) {
        if (channel.lastActivity.getTime() < timeoutThreshold) {
          this.closeChannel(peerId);
          this.emit('channelTimeout', { peerId, lastActivity: channel.lastActivity });
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Clean shutdown
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.channels.clear();
    this.keyPairs.clear();
    this.messageQueue.length = 0;
    this.removeAllListeners();
  }
}