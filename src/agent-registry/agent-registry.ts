import { EventEmitter } from 'events';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  version: string;
  parameters: Record<string, any>;
  performance: {
    accuracy: number;
    latency: number;
    throughput: number;
  };
}

export interface AgentEndpoint {
  protocol: 'http' | 'websocket' | 'grpc';
  url: string;
  authentication: {
    type: 'bearer' | 'api-key' | 'oauth2';
    credentials?: Record<string, any>;
  };
  healthCheck: {
    path: string;
    interval: number; // milliseconds
    timeout: number; // milliseconds
  };
}

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  reputation: number;
  totalTasks: number;
  successRate: number;
}

export interface AgentRegistration {
  id: string;
  capabilities: AgentCapability[];
  endpoints: AgentEndpoint[];
  metadata: AgentMetadata;
  status: 'registering' | 'active' | 'inactive' | 'suspended';
  lastHeartbeat: Date;
  registeredAt: Date;
}

export interface DiscoveryQuery {
  requiredCapabilities?: string[];
  capabilityCategories?: AgentCategory[];
  minReputation?: number;
  maxLatency?: number;
  location?: GeographicLocation;
  tags?: string[];
  limit?: number;
  sortBy?: 'reputation' | 'latency' | 'successRate' | 'totalTasks';
  sortOrder?: 'asc' | 'desc';
}

export interface GeographicLocation {
  latitude: number;
  longitude: number;
  region: string;
  country: string;
}

export enum AgentCategory {
  DATA_PROCESSING = 'data_processing',
  NATURAL_LANGUAGE = 'natural_language',
  COMPUTER_VISION = 'computer_vision',
  AUDIO_PROCESSING = 'audio_processing',
  REASONING = 'reasoning',
  COORDINATION = 'coordination',
  VALIDATION = 'validation',
  STORAGE = 'storage'
}

export interface DiscoveryResult {
  agents: AgentRegistration[];
  totalFound: number;
  query: DiscoveryQuery;
  searchTime: number;
}

export interface AgentHealthStatus {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: Date;
  responseTime: number;
  errorMessage?: string;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentRegistration> = new Map();
  private healthStatus: Map<string, AgentHealthStatus> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private heartbeatIntervalMs: number = 30000, // 30 seconds
    private healthCheckTimeoutMs: number = 5000   // 5 seconds
  ) {
    super();
    this.startHeartbeatMonitoring();
  }

  /**
   * Register a new agent in the registry
   */
  registerAgent(
    id: string,
    capabilities: AgentCapability[],
    endpoints: AgentEndpoint[],
    metadata: Omit<AgentMetadata, 'createdAt' | 'updatedAt'>
  ): AgentRegistration {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} is already registered`);
    }

    const registration: AgentRegistration = {
      id,
      capabilities,
      endpoints,
      metadata: {
        ...metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      status: 'registering',
      lastHeartbeat: new Date(),
      registeredAt: new Date()
    };

    this.agents.set(id, registration);
    this.initializeHealthStatus(id);

    this.emit('agentRegistered', registration);
    return registration;
  }

  /**
   * Update agent capabilities
   */
  updateCapabilities(agentId: string, capabilities: AgentCapability[]): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.capabilities = capabilities;
    agent.metadata.updatedAt = new Date();

    this.emit('agentCapabilitiesUpdated', { agentId, capabilities });
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentRegistration['status']): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const oldStatus = agent.status;
    agent.status = status;
    agent.metadata.updatedAt = new Date();

    this.emit('agentStatusUpdated', { agentId, oldStatus, newStatus: status });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.agents.delete(agentId);
    this.healthStatus.delete(agentId);

    this.emit('agentUnregistered', agent);
  }

  /**
   * Record agent heartbeat
   */
  recordHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.lastHeartbeat = new Date();

    // Activate agent if it was registering
    if (agent.status === 'registering') {
      this.updateAgentStatus(agentId, 'active');
    }

    this.emit('agentHeartbeat', { agentId, timestamp: agent.lastHeartbeat });
  }

  /**
   * Discover agents based on query criteria
   */
  discoverAgents(query: DiscoveryQuery): DiscoveryResult {
    const startTime = Date.now();
    let candidates = Array.from(this.agents.values())
      .filter(agent => agent.status === 'active');

    // Filter by required capabilities
    if (query.requiredCapabilities && query.requiredCapabilities.length > 0) {
      candidates = candidates.filter(agent =>
        query.requiredCapabilities!.every(reqCap =>
          agent.capabilities.some(cap => cap.id === reqCap)
        )
      );
    }

    // Filter by capability categories
    if (query.capabilityCategories && query.capabilityCategories.length > 0) {
      candidates = candidates.filter(agent =>
        agent.capabilities.some(cap =>
          query.capabilityCategories!.includes(cap.category)
        )
      );
    }

    // Filter by minimum reputation
    if (query.minReputation !== undefined) {
      candidates = candidates.filter(agent =>
        agent.metadata.reputation >= query.minReputation!
      );
    }

    // Filter by maximum latency
    if (query.maxLatency !== undefined) {
      candidates = candidates.filter(agent =>
        agent.capabilities.some(cap =>
          cap.performance.latency <= query.maxLatency!
        )
      );
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      candidates = candidates.filter(agent =>
        query.tags!.some(tag => agent.metadata.tags.includes(tag))
      );
    }

    // Sort results
    const sortBy = query.sortBy || 'reputation';
    const sortOrder = query.sortOrder || 'desc';

    candidates.sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case 'reputation':
          aValue = a.metadata.reputation;
          bValue = b.metadata.reputation;
          break;
        case 'latency':
          aValue = Math.min(...a.capabilities.map(c => c.performance.latency));
          bValue = Math.min(...b.capabilities.map(c => c.performance.latency));
          break;
        case 'successRate':
          aValue = a.metadata.successRate;
          bValue = b.metadata.successRate;
          break;
        case 'totalTasks':
          aValue = a.metadata.totalTasks;
          bValue = b.metadata.totalTasks;
          break;
        default:
          aValue = a.metadata.reputation;
          bValue = b.metadata.reputation;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Apply limit
    const limit = query.limit || 10;
    const results = candidates.slice(0, limit);

    const searchTime = Date.now() - startTime;

    const result: DiscoveryResult = {
      agents: results,
      totalFound: candidates.length,
      query,
      searchTime
    };

    this.emit('agentsDiscovered', result);
    return result;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentRegistration['status']): AgentRegistration[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.status === status);
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentId: string): AgentHealthStatus | undefined {
    return this.healthStatus.get(agentId);
  }

  /**
   * Get all agent health statuses
   */
  getAllHealthStatuses(): AgentHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Initialize health status for a new agent
   */
  private initializeHealthStatus(agentId: string): void {
    const healthStatus: AgentHealthStatus = {
      agentId,
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 0
    };

    this.healthStatus.set(agentId, healthStatus);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = now - (this.heartbeatIntervalMs * 3); // 3x interval

      for (const [agentId, agent] of this.agents) {
        if (agent.status === 'active' && agent.lastHeartbeat.getTime() < timeoutThreshold) {
          this.updateAgentStatus(agentId, 'inactive');
          this.emit('agentTimeout', { agentId, lastHeartbeat: agent.lastHeartbeat });
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopHeartbeatMonitoring();
    this.agents.clear();
    this.healthStatus.clear();
    this.removeAllListeners();
  }
}