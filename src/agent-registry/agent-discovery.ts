import { AgentRegistry, DiscoveryQuery, DiscoveryResult, AgentRegistration, AgentCategory } from './agent-registry';

export interface DiscoveryCache {
  query: DiscoveryQuery;
  result: DiscoveryResult;
  timestamp: Date;
  ttl: number; // milliseconds
}

export interface DiscoveryMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageSearchTime: number;
  totalAgentsDiscovered: number;
}

export class AgentDiscoveryService {
  private cache: Map<string, DiscoveryCache> = new Map();
  private metrics: DiscoveryMetrics = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageSearchTime: 0,
    totalAgentsDiscovered: 0
  };

  constructor(
    private registry: AgentRegistry,
    private cacheEnabled: boolean = true,
    private defaultCacheTtl: number = 300000 // 5 minutes
  ) {
    // Set up registry event listeners
    this.registry.on('agentRegistered', (agent) => {
      this.invalidateCacheForAgent(agent);
    });

    this.registry.on('agentUnregistered', (agent) => {
      this.invalidateCacheForAgent(agent);
    });

    this.registry.on('agentStatusUpdated', ({ agentId }) => {
      this.invalidateCacheForAgentId(agentId);
    });

    this.registry.on('agentCapabilitiesUpdated', ({ agentId }) => {
      this.invalidateCacheForAgentId(agentId);
    });
  }

  /**
   * Discover agents with caching and optimization
   */
  discoverAgents(query: DiscoveryQuery): DiscoveryResult {
    this.metrics.totalQueries++;

    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(query);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        this.metrics.cacheHits++;
        return {
          ...cached.result,
          searchTime: cached.result.searchTime // Keep original search time
        };
      }
    }

    this.metrics.cacheMisses++;

    // Perform actual discovery
    const result = this.registry.discoverAgents(query);

    // Update metrics
    this.metrics.totalAgentsDiscovered += result.agents.length;
    this.metrics.averageSearchTime =
      (this.metrics.averageSearchTime * (this.metrics.totalQueries - 1) + result.searchTime) /
      this.metrics.totalQueries;

    // Cache result
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(query);
      const cacheEntry: DiscoveryCache = {
        query,
        result,
        timestamp: new Date(),
        ttl: this.getCacheTtl(query)
      };
      this.cache.set(cacheKey, cacheEntry);
    }

    return result;
  }

  /**
   * Advanced discovery with semantic matching
   */
  discoverAgentsAdvanced(query: DiscoveryQuery & {
    semanticSearch?: string;
    performanceRequirements?: {
      minAccuracy?: number;
      maxLatency?: number;
      minThroughput?: number;
    };
    compatibilityCheck?: (agent: AgentRegistration) => boolean;
  }): DiscoveryResult {
    let result = this.discoverAgents(query);

    // Apply semantic search if provided
    if (query.semanticSearch) {
      result = this.applySemanticSearch(result, query.semanticSearch);
    }

    // Apply performance requirements
    if (query.performanceRequirements) {
      result = this.applyPerformanceFilter(result, query.performanceRequirements);
    }

    // Apply custom compatibility check
    if (query.compatibilityCheck) {
      result.agents = result.agents.filter(query.compatibilityCheck);
      result.totalFound = result.agents.length;
    }

    return result;
  }

  /**
   * Find best agent for a specific task
   */
  findBestAgentForTask(
    taskRequirements: {
      requiredCapabilities: string[];
      preferredCategories?: AgentCategory[];
      maxLatency?: number;
      minReputation?: number;
      location?: { latitude: number; longitude: number; radius: number };
    }
  ): AgentRegistration | null {
    const query: DiscoveryQuery = {
      requiredCapabilities: taskRequirements.requiredCapabilities,
      capabilityCategories: taskRequirements.preferredCategories,
      maxLatency: taskRequirements.maxLatency,
      minReputation: taskRequirements.minReputation,
      limit: 1,
      sortBy: 'reputation',
      sortOrder: 'desc'
    };

    const result = this.discoverAgents(query);

    if (result.agents.length === 0) {
      return null;
    }

    let bestAgent = result.agents[0];

    // Apply location-based filtering if specified
    if (taskRequirements.location) {
      const agentsWithLocation = result.agents.filter(agent => {
        // In a real implementation, you'd check agent metadata for location
        // For now, we'll assume location compatibility
        return true;
      });

      if (agentsWithLocation.length > 0) {
        bestAgent = agentsWithLocation[0];
      }
    }

    return bestAgent;
  }

  /**
   * Get discovery recommendations based on usage patterns
   */
  getDiscoveryRecommendations(userId: string, limit: number = 5): DiscoveryQuery[] {
    // In a real implementation, this would analyze user behavior patterns
    // For now, return some common useful queries
    return [
      {
        capabilityCategories: [AgentCategory.DATA_PROCESSING],
        sortBy: 'reputation',
        sortOrder: 'desc',
        limit
      },
      {
        capabilityCategories: [AgentCategory.NATURAL_LANGUAGE],
        minReputation: 0.8,
        sortBy: 'successRate',
        sortOrder: 'desc',
        limit
      },
      {
        capabilityCategories: [AgentCategory.COMPUTER_VISION],
        maxLatency: 1000,
        sortBy: 'latency',
        sortOrder: 'asc',
        limit
      }
    ];
  }

  /**
   * Get discovery metrics
   */
  getMetrics(): DiscoveryMetrics & {
    cacheSize: number;
    cacheHitRate: number;
  } {
    const cacheHitRate = this.metrics.totalQueries > 0
      ? this.metrics.cacheHits / this.metrics.totalQueries
      : 0;

    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate
    };
  }

  /**
   * Clear discovery cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate cache key from query
   */
  private generateCacheKey(query: DiscoveryQuery): string {
    // Create a deterministic string representation of the query
    const keyParts = [
      query.requiredCapabilities?.sort().join(',') || '',
      query.capabilityCategories?.sort().join(',') || '',
      query.minReputation?.toString() || '',
      query.maxLatency?.toString() || '',
      query.location ? `${query.location.latitude},${query.location.longitude}` : '',
      query.tags?.sort().join(',') || '',
      query.limit?.toString() || '',
      query.sortBy || '',
      query.sortOrder || ''
    ];

    return keyParts.join('|');
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(cache: DiscoveryCache): boolean {
    const now = Date.now();
    const cacheAge = now - cache.timestamp.getTime();
    return cacheAge < cache.ttl;
  }

  /**
   * Get appropriate cache TTL for a query
   */
  private getCacheTtl(query: DiscoveryQuery): number {
    // More specific queries can be cached longer
    const specificity = [
      query.requiredCapabilities?.length || 0,
      query.capabilityCategories?.length || 0,
      query.tags?.length || 0,
      query.location ? 1 : 0
    ].reduce((sum, val) => sum + val, 0);

    // Higher specificity = longer cache time
    if (specificity >= 3) return this.defaultCacheTtl * 2; // 10 minutes
    if (specificity >= 1) return this.defaultCacheTtl;     // 5 minutes
    return this.defaultCacheTtl / 2;                       // 2.5 minutes
  }

  /**
   * Invalidate cache entries affected by agent changes
   */
  private invalidateCacheForAgent(agent: AgentRegistration): void {
    // Invalidate all cache entries since agent changes could affect many queries
    this.clearCache();
  }

  /**
   * Invalidate cache entries for a specific agent
   */
  private invalidateCacheForAgentId(agentId: string): void {
    // For targeted invalidation, we'd need to track which queries include which agents
    // For simplicity, we'll clear all cache
    this.clearCache();
  }

  /**
   * Apply semantic search to discovery results
   */
  private applySemanticSearch(result: DiscoveryResult, searchTerm: string): DiscoveryResult {
    // Simple text-based semantic search
    // In a real implementation, this would use NLP models
    const searchTerms = searchTerm.toLowerCase().split(' ');

    const filteredAgents = result.agents.filter(agent => {
      const searchableText = [
        agent.metadata.name,
        agent.metadata.description,
        ...agent.metadata.tags,
        ...agent.capabilities.map(c => c.name),
        ...agent.capabilities.map(c => c.description)
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });

    return {
      ...result,
      agents: filteredAgents,
      totalFound: filteredAgents.length
    };
  }

  /**
   * Apply performance requirements filter
   */
  private applyPerformanceFilter(
    result: DiscoveryResult,
    requirements: {
      minAccuracy?: number;
      maxLatency?: number;
      minThroughput?: number;
    }
  ): DiscoveryResult {
    const filteredAgents = result.agents.filter(agent => {
      return agent.capabilities.some(capability => {
        const perf = capability.performance;

        if (requirements.minAccuracy && perf.accuracy < requirements.minAccuracy) {
          return false;
        }
        if (requirements.maxLatency && perf.latency > requirements.maxLatency) {
          return false;
        }
        if (requirements.minThroughput && perf.throughput < requirements.minThroughput) {
          return false;
        }

        return true;
      });
    });

    return {
      ...result,
      agents: filteredAgents,
      totalFound: filteredAgents.length
    };
  }
}