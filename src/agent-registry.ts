import {
  AgentMetadata,
  AgentRegistrationRequest,
  AgentDiscoveryQuery,
  AgentDiscoveryResult,
  SwarmCoordinationRequest,
  SwarmFormation,
  AgentStatus,
  SwarmStatus,
  AgentCapabilities,
  HEARTBEAT_INTERVAL,
  REGISTRATION_TIMEOUT
} from './agent-protocol-types.js';

interface StoredAgent extends AgentMetadata {
  // Internal fields for agent management
}

export class AgentRegistryService {
  private agents: Map<string, StoredAgent> = new Map();
  private swarms: Map<string, SwarmFormation> = new Map();
  private registrationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private swarmTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a new AI agent
   */
  async registerAgent(request: AgentRegistrationRequest): Promise<{ success: boolean; agentId?: string; error?: string }> {
    try {
      // Validate request
      if (!this.validateRegistrationRequest(request)) {
        return { success: false, error: 'Invalid registration request' };
      }

      // Verify signature (simplified - in production use proper crypto verification)
      if (!await this.verifySignature(request)) {
        return { success: false, error: 'Invalid signature' };
      }

      // Generate unique agent ID
      const agentId = this.generateAgentId();

      // Create agent metadata
      const agent: StoredAgent = {
        ...request.metadata,
        id: agentId,
        registeredAt: Date.now(),
        lastSeen: Date.now(),
        status: AgentStatus.REGISTERING
      };

      // Store agent
      this.agents.set(agentId, agent);

      // Set registration timeout
      const registrationTimer = setTimeout(() => {
        const storedAgent = this.agents.get(agentId);
        if (storedAgent && storedAgent.status === AgentStatus.REGISTERING) {
          storedAgent.status = AgentStatus.INACTIVE;
        }
      }, REGISTRATION_TIMEOUT);
      this.registrationTimeouts.set(agentId, registrationTimer);

      return { success: true, agentId };
    } catch (error) {
      console.error('Agent registration failed:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Destroy service and clear timers
   */
  destroy(): void {
    for (const timer of this.registrationTimeouts.values()) {
      clearTimeout(timer);
    }
    this.registrationTimeouts.clear();
    for (const timer of this.swarmTimeouts.values()) {
      clearTimeout(timer);
    }
    this.swarmTimeouts.clear();
    this.agents.clear();
    this.swarms.clear();
  }

  /**
   * Update agent status and heartbeat
   */
  async updateAgentHeartbeat(agentId: string): Promise<{ success: boolean; error?: string }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    agent.lastSeen = Date.now();

    // Activate agent after first heartbeat
    if (agent.status === AgentStatus.REGISTERING) {
      agent.status = AgentStatus.ACTIVE;
    }

    return { success: true };
  }

  /**
   * Discover agents based on query criteria
   */
  async discoverAgents(query: AgentDiscoveryQuery): Promise<AgentDiscoveryResult> {
    let agents = Array.from(this.agents.values());

    // Apply filters
    if (query.categories && query.categories.length > 0) {
      agents = agents.filter(agent => query.categories!.includes(agent.category));
    }

    if (query.capabilities && query.capabilities.length > 0) {
      agents = agents.filter(agent =>
        query.capabilities!.some(cap =>
          agent.capabilities.some(agentCap => agentCap.id === cap)
        )
      );
    }

    if (query.owner) {
      agents = agents.filter(agent => agent.owner === query.owner);
    }

    if (query.status) {
      agents = agents.filter(agent => agent.status === query.status);
    }

    if (query.minReputation !== undefined) {
      agents = agents.filter(agent => agent.security.reputation >= query.minReputation!);
    }

    if (query.maxLatency !== undefined) {
      agents = agents.filter(agent => {
        const latency = Date.now() - agent.lastSeen;
        return latency <= query.maxLatency!;
      });
    }

    // Only return active agents
    agents = agents.filter(agent => agent.status === AgentStatus.ACTIVE);

    return {
      agents: agents.map(agent => ({ ...agent })), // Remove internal fields
      totalCount: agents.length,
      query,
      timestamp: Date.now()
    };
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentMetadata | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    // Return public metadata
    return agent;
  }

  /**
   * Update agent metadata
   */
  async updateAgent(agentId: string, updates: Partial<AgentMetadata>): Promise<{ success: boolean; error?: string }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    // Update allowed fields
    Object.assign(agent, updates);
    agent.lastSeen = Date.now();

    return { success: true };
  }

  /**
   * Remove agent
   */
  async removeAgent(agentId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.agents.has(agentId)) {
      return { success: false, error: 'Agent not found' };
    }

    const regTimer = this.registrationTimeouts.get(agentId);
    if (regTimer) {
      clearTimeout(regTimer);
      this.registrationTimeouts.delete(agentId);
    }
    this.agents.delete(agentId);
    return { success: true };
  }

  /**
   * Coordinate swarm formation
   */
  async coordinateSwarm(request: SwarmCoordinationRequest): Promise<{ success: boolean; swarm?: SwarmFormation; error?: string }> {
    try {
      // Discover suitable agents for the task (participants)
      const participantQuery: AgentDiscoveryQuery = {
        capabilities: request.requiredCapabilities,
        status: AgentStatus.ACTIVE,
        minReputation: request.constraints?.minReputation || 0.5
      };

      const participantResult = await this.discoverAgents(participantQuery);

      // Discover coordination-capable agents
      const coordinatorQuery: AgentDiscoveryQuery = {
        capabilities: ['coordination'],
        status: AgentStatus.ACTIVE,
        minReputation: request.constraints?.minReputation || 0.5
      };

      const coordinatorResult = await this.discoverAgents(coordinatorQuery);

      if (coordinatorResult.agents.length === 0) {
        return { success: false, error: 'No coordination-capable agents available' };
      }

      // Select coordinator (highest reputation)
      const coordinator = coordinatorResult.agents
        .sort((a, b) => b.security.reputation - a.security.reputation)[0];

      // Select participants (up to maxAgents, sorted by relevance, excluding coordinator)
      const participants = participantResult.agents
        .filter(agent => agent.id !== coordinator.id)
        .sort((a, b) => b.security.reputation - a.security.reputation)
        .slice(0, request.constraints?.maxAgents || 10);

      if (participants.length === 0) {
        return { success: false, error: 'No suitable participant agents found' };
      }

      // Create swarm
      const swarm: SwarmFormation = {
        id: this.generateSwarmId(),
        coordinator,
        participants,
        capabilities: this.aggregateCapabilities([coordinator, ...participants]),
        formedAt: Date.now(),
        expectedCompletion: request.deadline,
        status: SwarmStatus.FORMING
      };

      this.swarms.set(swarm.id, swarm);

      // Transition to active after formation
      const swarmTimer = setTimeout(() => {
        const storedSwarm = this.swarms.get(swarm.id);
        if (storedSwarm && storedSwarm.status === SwarmStatus.FORMING) {
          storedSwarm.status = SwarmStatus.ACTIVE;
        }
      }, 5000); // 5 second formation period
      this.swarmTimeouts.set(swarm.id, swarmTimer);

      return { success: true, swarm };
    } catch (error) {
      console.error('Swarm coordination failed:', error);
      return { success: false, error: 'Swarm coordination failed' };
    }
  }

  /**
   * Get swarm status
   */
  async getSwarm(swarmId: string): Promise<SwarmFormation | null> {
    return this.swarms.get(swarmId) || null;
  }

  /**
   * Clean up inactive agents and expired swarms
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const heartbeatTimeout = HEARTBEAT_INTERVAL * 3; // 3 missed heartbeats
    const registrationTimeout = REGISTRATION_TIMEOUT * 2; // 2x registration timeout

    // Remove inactive agents
    for (const [agentId, agent] of this.agents.entries()) {
      const shouldRemove =
        // Remove agents that haven't activated and registration has expired
        (agent.status === AgentStatus.REGISTERING && now - agent.registeredAt > registrationTimeout) ||
        // Remove active agents that haven't sent heartbeats
        (agent.status === AgentStatus.ACTIVE && now - agent.lastSeen > heartbeatTimeout);

      if (shouldRemove) {
        console.log(`Removing inactive agent: ${agentId} (status: ${agent.status})`);
        // clear registration timer if present
        const regTimer = this.registrationTimeouts.get(agentId);
        if (regTimer) {
          clearTimeout(regTimer);
          this.registrationTimeouts.delete(agentId);
        }
        this.agents.delete(agentId);
      }
    }

    // Clean up expired swarms
    for (const [swarmId, swarm] of this.swarms.entries()) {
      if (swarm.expectedCompletion && now > swarm.expectedCompletion) {
        console.log(`Removing expired swarm: ${swarmId}`);
        const sTimer = this.swarmTimeouts.get(swarmId);
        if (sTimer) {
          clearTimeout(sTimer);
          this.swarmTimeouts.delete(swarmId);
        }
        this.swarms.delete(swarmId);
      }
    }
  }

  // Private helper methods
  private validateRegistrationRequest(request: AgentRegistrationRequest): boolean {
    const { metadata } = request;

    if (!metadata.name || !metadata.owner || !metadata.capabilities.length) {
      return false;
    }

    if (!metadata.endpoints.length) {
      return false;
    }

    // Validate capabilities
    for (const cap of metadata.capabilities) {
      if (!cap.id || !cap.name || !cap.version) {
        return false;
      }
    }

    return true;
  }

  private async verifySignature(request: AgentRegistrationRequest): Promise<boolean> {
    // Simplified signature verification - in production, implement proper crypto
    // This should verify that the signature was created by the owner
    return !!(request.signature && request.signature.length > 10);
  }

  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSwarmId(): string {
    return `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private aggregateCapabilities(agents: AgentMetadata[]): (AgentCapabilities & { agentCount: number })[] {
    const capabilityMap = new Map();

    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        if (!capabilityMap.has(cap.id)) {
          capabilityMap.set(cap.id, { ...cap, agentCount: 0 });
        }
        capabilityMap.get(cap.id).agentCount++;
      }
    }

    return Array.from(capabilityMap.values());
  }
}
