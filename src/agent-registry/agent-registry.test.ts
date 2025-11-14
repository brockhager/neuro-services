import {
  AgentRegistry,
  AgentDiscoveryService,
  AgentCapability,
  AgentEndpoint,
  AgentMetadata,
  AgentCategory,
  DiscoveryQuery
} from './index';

describe('Agent Registry and Discovery', () => {
  let registry: AgentRegistry;
  let discovery: AgentDiscoveryService;

  beforeEach(() => {
    registry = new AgentRegistry();
    discovery = new AgentDiscoveryService(registry);
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('Agent Registration', () => {
    const sampleMetadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'> = {
      name: 'Test Agent',
      description: 'A test AI agent',
      version: '1.0.0',
      author: 'Test Author',
      license: 'MIT',
      tags: ['test', 'ai'],
      reputation: 0.95,
      totalTasks: 1000,
      successRate: 0.92
    };

    const sampleCapabilities: AgentCapability[] = [
      {
        id: 'text-processing',
        name: 'Text Processing',
        description: 'Natural language processing capabilities',
        category: AgentCategory.NATURAL_LANGUAGE,
        version: '1.0',
        parameters: { maxTokens: 4096 },
        performance: {
          accuracy: 0.95,
          latency: 500,
          throughput: 100
        }
      }
    ];

    const sampleEndpoints: AgentEndpoint[] = [
      {
        protocol: 'http',
        url: 'http://localhost:3000',
        authentication: {
          type: 'bearer'
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000
        }
      }
    ];

    it('should register an agent successfully', () => {
      const agentId = 'test-agent-1';

      const registration = registry.registerAgent(
        agentId,
        sampleCapabilities,
        sampleEndpoints,
        sampleMetadata
      );

      expect(registration.id).toBe(agentId);
      expect(registration.capabilities).toEqual(sampleCapabilities);
      expect(registration.endpoints).toEqual(sampleEndpoints);
      expect(registration.metadata.name).toBe(sampleMetadata.name);
      expect(registration.status).toBe('registering');
      expect(registration.registeredAt).toBeInstanceOf(Date);
    });

    it('should reject duplicate agent registration', () => {
      const agentId = 'test-agent-1';

      registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);

      expect(() => {
        registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);
      }).toThrow('Agent test-agent-1 is already registered');
    });

    it('should update agent capabilities', () => {
      const agentId = 'test-agent-1';
      registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);

      const newCapabilities = [
        ...sampleCapabilities,
        {
          id: 'image-processing',
          name: 'Image Processing',
          description: 'Computer vision capabilities',
          category: AgentCategory.COMPUTER_VISION,
          version: '1.0',
          parameters: { maxResolution: '4K' },
          performance: {
            accuracy: 0.88,
            latency: 1000,
            throughput: 50
          }
        }
      ];

      registry.updateCapabilities(agentId, newCapabilities);

      const agent = registry.getAgent(agentId);
      expect(agent?.capabilities).toEqual(newCapabilities);
    });

    it('should update agent status', () => {
      const agentId = 'test-agent-1';
      registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);

      registry.updateAgentStatus(agentId, 'active');

      const agent = registry.getAgent(agentId);
      expect(agent?.status).toBe('active');
    });

    it('should record heartbeats and activate registering agents', () => {
      const agentId = 'test-agent-1';
      registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);

      expect(registry.getAgent(agentId)?.status).toBe('registering');

      registry.recordHeartbeat(agentId);

      expect(registry.getAgent(agentId)?.status).toBe('active');
    });

    it('should unregister agents', () => {
      const agentId = 'test-agent-1';
      registry.registerAgent(agentId, sampleCapabilities, sampleEndpoints, sampleMetadata);

      registry.unregisterAgent(agentId);

      expect(registry.getAgent(agentId)).toBeUndefined();
    });
  });

  describe('Agent Discovery', () => {
    beforeEach(() => {
      // Register multiple test agents
      const agents: Array<{
        id: string;
        capabilities: AgentCapability[];
        metadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'>;
      }> = [
        {
          id: 'nlp-agent',
          capabilities: [{
            id: 'text-analysis',
            name: 'Text Analysis',
            description: 'NLP capabilities',
            category: AgentCategory.NATURAL_LANGUAGE,
            version: '1.0',
            parameters: {},
            performance: { accuracy: 0.95, latency: 300, throughput: 200 }
          }],
          metadata: {
            name: 'NLP Agent',
            description: 'Natural language processing',
            version: '1.0',
            author: 'AI Team',
            license: 'MIT',
            tags: ['nlp', 'text'],
            reputation: 0.92,
            totalTasks: 5000,
            successRate: 0.94
          }
        },
        {
          id: 'vision-agent',
          capabilities: [{
            id: 'image-recognition',
            name: 'Image Recognition',
            description: 'Computer vision capabilities',
            category: AgentCategory.COMPUTER_VISION,
            version: '1.0',
            parameters: {},
            performance: { accuracy: 0.88, latency: 800, throughput: 50 }
          }],
          metadata: {
            name: 'Vision Agent',
            description: 'Computer vision processing',
            version: '1.0',
            author: 'Vision Team',
            license: 'MIT',
            tags: ['vision', 'images'],
            reputation: 0.85,
            totalTasks: 2000,
            successRate: 0.89
          }
        },
        {
          id: 'data-agent',
          capabilities: [{
            id: 'data-processing',
            name: 'Data Processing',
            description: 'Data analysis capabilities',
            category: AgentCategory.DATA_PROCESSING,
            version: '1.0',
            parameters: {},
            performance: { accuracy: 0.96, latency: 200, throughput: 300 }
          }],
          metadata: {
            name: 'Data Agent',
            description: 'Data processing and analysis',
            version: '1.0',
            author: 'Data Team',
            license: 'MIT',
            tags: ['data', 'analytics'],
            reputation: 0.88,
            totalTasks: 8000,
            successRate: 0.95
          }
        }
      ];

      agents.forEach(({ id, capabilities, metadata }) => {
        registry.registerAgent(id, capabilities, [], metadata);
        registry.updateAgentStatus(id, 'active');
      });
    });

    it('should discover all active agents', () => {
      const result = discovery.discoverAgents({});

      expect(result.agents).toHaveLength(3);
      expect(result.totalFound).toBe(3);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should filter by capability categories', () => {
      const result = discovery.discoverAgents({
        capabilityCategories: [AgentCategory.NATURAL_LANGUAGE]
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('nlp-agent');
    });

    it('should filter by minimum reputation', () => {
      const result = discovery.discoverAgents({
        minReputation: 0.9
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('nlp-agent');
    });

    it('should filter by maximum latency', () => {
      const result = discovery.discoverAgents({
        maxLatency: 500
      });

      expect(result.agents).toHaveLength(2); // nlp-agent (300ms) and data-agent (200ms)
      expect(result.agents.map(a => a.id).sort()).toEqual(['data-agent', 'nlp-agent']);
    });

    it('should filter by tags', () => {
      const result = discovery.discoverAgents({
        tags: ['vision']
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('vision-agent');
    });

    it('should sort by reputation descending', () => {
      const result = discovery.discoverAgents({
        sortBy: 'reputation',
        sortOrder: 'desc'
      });

      expect(result.agents[0].id).toBe('nlp-agent'); // 0.92
      expect(result.agents[1].id).toBe('data-agent'); // 0.88
      expect(result.agents[2].id).toBe('vision-agent'); // 0.85
    });

    it('should limit results', () => {
      const result = discovery.discoverAgents({
        limit: 2
      });

      expect(result.agents).toHaveLength(2);
      expect(result.totalFound).toBe(3);
    });

    it('should find best agent for task', () => {
      const bestAgent = discovery.findBestAgentForTask({
        requiredCapabilities: ['text-analysis']
      });

      expect(bestAgent?.id).toBe('nlp-agent');
    });

    it('should return null when no agent matches requirements', () => {
      const bestAgent = discovery.findBestAgentForTask({
        requiredCapabilities: ['non-existent-capability']
      });

      expect(bestAgent).toBeNull();
    });
  });

  describe('Discovery Caching', () => {
    beforeEach(() => {
      const metadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'> = {
        name: 'Test Agent',
        description: 'Test',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.9
      };

      registry.registerAgent('test-agent', [], [], metadata);
      registry.updateAgentStatus('test-agent', 'active');
    });

    it('should cache discovery results', () => {
      const query: DiscoveryQuery = { limit: 10 };

      // First query
      const result1 = discovery.discoverAgents(query);
      const metrics1 = discovery.getMetrics();

      // Second query (should hit cache)
      const result2 = discovery.discoverAgents(query);
      const metrics2 = discovery.getMetrics();

      expect(metrics2.cacheHits).toBe(metrics1.cacheHits + 1);
      expect(metrics2.cacheMisses).toBe(metrics1.cacheMisses);
      expect(result1.agents).toEqual(result2.agents);
    });

    it('should invalidate cache when agents change', () => {
      const query: DiscoveryQuery = {};

      // Query once
      discovery.discoverAgents(query);
      const metricsAfterFirst = discovery.getMetrics();

      // Register new agent (should invalidate cache)
      const metadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'> = {
        name: 'New Agent',
        description: 'New',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8,
        totalTasks: 50,
        successRate: 0.85
      };

      registry.registerAgent('new-agent', [], [], metadata);
      registry.updateAgentStatus('new-agent', 'active');

      // Query again (should miss cache)
      discovery.discoverAgents(query);
      const metricsAfterSecond = discovery.getMetrics();

      expect(metricsAfterSecond.cacheMisses).toBe(metricsAfterFirst.cacheMisses + 1);
    });
  });

  describe('Advanced Discovery Features', () => {
    beforeEach(() => {
      // Register test agents with different capabilities
      const agents = [
        {
          id: 'fast-nlp',
          capabilities: [{
            id: 'text-processing',
            name: 'Fast Text Processing',
            description: 'High-speed NLP',
            category: AgentCategory.NATURAL_LANGUAGE,
            version: '1.0',
            parameters: {},
            performance: { accuracy: 0.9, latency: 100, throughput: 500 }
          }],
          metadata: {
            name: 'Fast NLP Agent',
            description: 'Fast natural language processing',
            version: '1.0',
            author: 'AI Team',
            license: 'MIT',
            tags: ['nlp', 'fast', 'text'],
            reputation: 0.88,
            totalTasks: 10000,
            successRate: 0.93
          }
        },
        {
          id: 'accurate-nlp',
          capabilities: [{
            id: 'text-processing',
            name: 'Accurate Text Processing',
            description: 'High-accuracy NLP',
            category: AgentCategory.NATURAL_LANGUAGE,
            version: '1.0',
            parameters: {},
            performance: { accuracy: 0.98, latency: 1000, throughput: 100 }
          }],
          metadata: {
            name: 'Accurate NLP Agent',
            description: 'High-accuracy natural language processing',
            version: '1.0',
            author: 'AI Team',
            license: 'MIT',
            tags: ['nlp', 'accurate', 'text'],
            reputation: 0.95,
            totalTasks: 5000,
            successRate: 0.96
          }
        }
      ];

      agents.forEach(({ id, capabilities, metadata }) => {
        registry.registerAgent(id, capabilities, [], metadata);
        registry.updateAgentStatus(id, 'active');
      });
    });

    it('should apply performance requirements filter', () => {
      const result = discovery.discoverAgentsAdvanced({
        capabilityCategories: [AgentCategory.NATURAL_LANGUAGE],
        performanceRequirements: {
          minAccuracy: 0.95,
          maxLatency: 500
        }
      });

      expect(result.agents).toHaveLength(0); // Neither agent meets both criteria
    });

    it('should apply semantic search', () => {
      const result = discovery.discoverAgentsAdvanced({
        semanticSearch: 'fast processing'
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('fast-nlp');
    });

    it('should apply custom compatibility check', () => {
      const result = discovery.discoverAgentsAdvanced({
        capabilityCategories: [AgentCategory.NATURAL_LANGUAGE],
        compatibilityCheck: (agent) => agent.metadata.totalTasks > 7500
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('fast-nlp');
    });
  });

  describe('Heartbeat Monitoring', () => {
    it('should mark agents as inactive after timeout', (done) => {
      // Create registry with short timeout for testing
      const testRegistry = new AgentRegistry(100, 5000); // 100ms interval

      const metadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'> = {
        name: 'Test Agent',
        description: 'Test',
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.9,
        totalTasks: 100,
        successRate: 0.9
      };

      testRegistry.registerAgent('test-agent', [], [], metadata);
      testRegistry.updateAgentStatus('test-agent', 'active');

      // Wait for timeout (300ms = 3 intervals)
      setTimeout(() => {
        const agent = testRegistry.getAgent('test-agent');
        expect(agent?.status).toBe('inactive');

        testRegistry.destroy();
        done();
      }, 350);
    });
  });
});