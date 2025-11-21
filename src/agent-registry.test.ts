/// <reference types="jest" />

import { AgentRegistryService } from './agent-registry.js';
import {
  AgentRegistrationRequest,
  AgentDiscoveryQuery,
  SwarmCoordinationRequest,
  AgentStatus,
  AgentCategory,
  REGISTRATION_TIMEOUT
} from './agent-protocol-types.js';

describe('AgentRegistryService', () => {
  let registry: AgentRegistryService;

  beforeEach(() => {
    registry = new AgentRegistryService();
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('registerAgent', () => {
    it('should register a valid agent', async () => {
      const request: AgentRegistrationRequest = {
        metadata: {
          name: 'Test Agent',
          owner: 'test-owner',
          description: 'A test agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [
            {
              id: 'computation',
              name: 'Computation',
              version: '1.0.0',
              description: 'Basic computation capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.8
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3000',
              protocols: ['http'],
              authRequired: false
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      const result = await registry.registerAgent(request);

      expect(result.success).toBe(true);
      expect(result.agentId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid registration request', async () => {
      const request: AgentRegistrationRequest = {
        metadata: {
          name: '',
          owner: '',
          description: 'Invalid agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.8
          },
          endpoints: []
        },
        signature: 'valid-signature'
      };

      const result = await registry.registerAgent(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid registration request');
    });
  });

  describe('updateAgentHeartbeat', () => {
    it('should update agent heartbeat', async () => {
      const request: AgentRegistrationRequest = {
        metadata: {
          name: 'Test Agent',
          owner: 'test-owner',
          description: 'A test agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [
            {
              id: 'computation',
              name: 'Computation',
              version: '1.0.0',
              description: 'Basic computation capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.8
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3000',
              protocols: ['http'],
              authRequired: false
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      const registerResult = await registry.registerAgent(request);
      const agentId = registerResult.agentId!;

      const heartbeatResult = await registry.updateAgentHeartbeat(agentId);

      expect(heartbeatResult.success).toBe(true);
    });
  });

  describe('discoverAgents', () => {
    beforeEach(async () => {
      const request: AgentRegistrationRequest = {
        metadata: {
          name: 'Test Agent',
          owner: 'test-owner',
          description: 'A test agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [
            {
              id: 'computation',
              name: 'Computation',
              version: '1.0.0',
              description: 'Basic computation capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.8
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3000',
              protocols: ['http'],
              authRequired: false
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      await registry.registerAgent(request);
      // Activate agent
      const agent = Array.from(registry['agents'].values())[0];
      agent.status = AgentStatus.ACTIVE;
    });

    it('should discover agents by category', async () => {
      const query: AgentDiscoveryQuery = {
        categories: [AgentCategory.DATA_PROCESSING]
      };

      const result = await registry.discoverAgents(query);

      expect(result.agents.length).toBe(1);
      expect(result.agents[0].category).toBe(AgentCategory.DATA_PROCESSING);
    });

    it('should discover agents by capabilities', async () => {
      const query: AgentDiscoveryQuery = {
        capabilities: ['computation']
      };

      const result = await registry.discoverAgents(query);

      expect(result.agents.length).toBe(1);
      expect(result.agents[0].capabilities[0].id).toBe('computation');
    });
  });

  describe('coordinateSwarm', () => {
    beforeEach(async () => {
      // Register coordinator agent
      const coordinatorRequest: AgentRegistrationRequest = {
        metadata: {
          name: 'Coordinator Agent',
          owner: 'coordinator-owner',
          description: 'A coordinator agent',
          version: '1.0.0',
          category: AgentCategory.COORDINATION,
          capabilities: [
            {
              id: 'coordination',
              name: 'Coordination',
              version: '1.0.0',
              description: 'Swarm coordination capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 2,
            memory: 1024,
            storage: 2048,
            network: 50
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.9
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3001',
              protocols: ['http'],
              authRequired: true
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      await registry.registerAgent(coordinatorRequest);
      const coordinator = Array.from(registry['agents'].values())[0];
      coordinator.status = AgentStatus.ACTIVE;

      // Register participant agent
      const participantRequest: AgentRegistrationRequest = {
        metadata: {
          name: 'Participant Agent',
          owner: 'participant-owner',
          description: 'A participant agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [
            {
              id: 'computation',
              name: 'Computation',
              version: '1.0.0',
              description: 'Computation capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.7
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3002',
              protocols: ['http'],
              authRequired: false
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      await registry.registerAgent(participantRequest);
      const participant = Array.from(registry['agents'].values())[1];
      participant.status = AgentStatus.ACTIVE;
    });

    it('should coordinate swarm formation', async () => {
      const request: SwarmCoordinationRequest = {
        swarmId: 'test-swarm-1',
        requiredCapabilities: ['computation'],
        task: 'Test computation task',
        priority: 'medium',
        constraints: {
          minReputation: 0.5,
          maxAgents: 5
        },
        deadline: Date.now() + 3600000 // 1 hour
      };

      const result = await registry.coordinateSwarm(request);

      expect(result.success).toBe(true);
      expect(result.swarm).toBeDefined();
      expect(result.swarm!.participants.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up inactive agents', async () => {
      const oldTime = Date.now() - (REGISTRATION_TIMEOUT * 2 + 1000); // Make it old enough

      const request: AgentRegistrationRequest = {
        metadata: {
          name: 'Test Agent',
          owner: 'test-owner',
          description: 'A test agent',
          version: '1.0.0',
          category: AgentCategory.DATA_PROCESSING,
          capabilities: [
            {
              id: 'computation',
              name: 'Computation',
              version: '1.0.0',
              description: 'Basic computation capability'
            }
          ],
          dependencies: [],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 1024,
            network: 10
          },
          security: {
            encryption: true,
            authentication: true,
            auditLogging: true,
            reputation: 0.8
          },
          endpoints: [
            {
              type: 'http',
              url: 'http://localhost:3000',
              protocols: ['http'],
              authRequired: false
            }
          ]
        },
        signature: 'valid-signature-1234567890'
      };

      await registry.registerAgent(request);

      // Manually set the registration time to be old
      const agent = Array.from(registry['agents'].values())[0];
      agent.registeredAt = oldTime;
      agent.lastSeen = oldTime;

      // Initially should have 1 agent
      expect(registry['agents'].size).toBe(1);

      // Run cleanup
      await registry.cleanup();

      // Should remove inactive agent
      expect(registry['agents'].size).toBe(0);
    });
  });
});