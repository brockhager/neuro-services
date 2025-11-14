// AI Agent Registration and Discovery Protocol
// Core types and interfaces for NeuroSwarm agent ecosystem

export interface AgentCapabilities {
  /** Unique capability identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Version of the capability */
  version: string;
  /** Description of what this capability does */
  description: string;
  /** Input/output schemas */
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** Performance metrics */
  performance?: {
    latency: number; // milliseconds
    throughput: number; // requests per second
    accuracy: number; // 0-1 scale
  };
}

export interface AgentMetadata {
  /** Unique agent identifier */
  id: string;
  /** Agent owner public key */
  owner: string;
  /** Human-readable name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent version */
  version: string;
  /** Agent category/type */
  category: AgentCategory;
  /** Capabilities this agent provides */
  capabilities: AgentCapabilities[];
  /** Required capabilities from other agents */
  dependencies: string[]; // capability IDs
  /** Resource requirements */
  resources: {
    cpu: number; // cores
    memory: number; // MB
    storage: number; // MB
    network: number; // Mbps
  };
  /** Security and trust metrics */
  security: {
    encryption: boolean;
    authentication: boolean;
    auditLogging: boolean;
    reputation: number; // 0-1 scale
  };
  /** Network endpoints */
  endpoints: AgentEndpoint[];
  /** Registration timestamp */
  registeredAt: number;
  /** Last heartbeat timestamp */
  lastSeen: number;
  /** Agent status */
  status: AgentStatus;
}

export interface AgentEndpoint {
  /** Endpoint type */
  type: 'http' | 'websocket' | 'grpc' | 'solana';
  /** Endpoint URL or address */
  url: string;
  /** Supported protocols */
  protocols: string[];
  /** Authentication requirements */
  authRequired: boolean;
}

export enum AgentCategory {
  // Core AI capabilities
  NATURAL_LANGUAGE = 'natural_language',
  COMPUTER_VISION = 'computer_vision',
  SPEECH_RECOGNITION = 'speech_recognition',
  GENERATIVE_AI = 'generative_ai',

  // Specialized domains
  MEDICAL = 'medical',
  FINANCIAL = 'financial',
  SCIENTIFIC = 'scientific',
  CREATIVE = 'creative',

  // Infrastructure
  COORDINATION = 'coordination',
  VALIDATION = 'validation',
  INDEXING = 'indexing',
  GATEWAY = 'gateway',

  // Utilities
  DATA_PROCESSING = 'data_processing',
  MONITORING = 'monitoring',
  SECURITY = 'security'
}

export enum AgentStatus {
  REGISTERING = 'registering',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DEPRECATED = 'deprecated'
}

export interface AgentRegistrationRequest {
  metadata: Omit<AgentMetadata, 'id' | 'registeredAt' | 'lastSeen' | 'status'>;
  signature: string; // Owner's signature of the metadata hash
}

export interface AgentDiscoveryQuery {
  /** Filter by categories */
  categories?: AgentCategory[];
  /** Filter by capabilities */
  capabilities?: string[];
  /** Filter by owner */
  owner?: string;
  /** Filter by status */
  status?: AgentStatus;
  /** Minimum reputation score */
  minReputation?: number;
  /** Geographic location preference */
  location?: string;
  /** Maximum latency requirement */
  maxLatency?: number;
  /** Required resources available */
  availableResources?: Partial<AgentMetadata['resources']>;
}

export interface AgentDiscoveryResult {
  agents: AgentMetadata[];
  totalCount: number;
  query: AgentDiscoveryQuery;
  timestamp: number;
}

export interface SwarmCoordinationRequest {
  /** Swarm identifier */
  swarmId: string;
  /** Required capabilities for the swarm task */
  requiredCapabilities: string[];
  /** Task description */
  task: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Deadline timestamp */
  deadline?: number;
  /** Resource constraints */
  constraints?: {
    maxAgents?: number;
    minReputation?: number;
    maxLatency?: number;
    budget?: number;
  };
}

export interface SwarmFormation {
  /** Unique swarm identifier */
  id: string;
  /** Coordinator agent */
  coordinator: AgentMetadata;
  /** Participating agents */
  participants: AgentMetadata[];
  /** Swarm capabilities */
  capabilities: AgentCapabilities[];
  /** Formation timestamp */
  formedAt: number;
  /** Expected completion */
  expectedCompletion?: number;
  /** Current status */
  status: SwarmStatus;
}

export enum SwarmStatus {
  FORMING = 'forming',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISSOLVED = 'dissolved'
}

// Protocol constants
export const AGENT_PROTOCOL_VERSION = '1.0.0';
export const MAX_AGENTS_PER_SWARM = 50;
export const MIN_AGENT_REPUTATION = 0.1;
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const REGISTRATION_TIMEOUT = 300000; // 5 minutes
export const DISCOVERY_CACHE_TTL = 60000; // 1 minute