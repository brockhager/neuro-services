import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { collectDefaultMetrics, register, Counter, Histogram } from "prom-client";
import { AgentRegistryService } from "./agent-registry";
import { AgentRegistry, AgentDiscoveryService, AgentCategory, DiscoveryQuery } from "./agent-registry/index";
import { SecureCommunicationFramework } from "./communication";
import { ConsensusEngine } from "./consensus/consensus-engine";
import { TokenomicsEngine } from "./tokenomics/tokenomics-engine";
import { SwarmCoordinator } from "./swarm-intelligence/swarm-coordinator";

interface User {
  username: string;
}

interface Manifest {
  cid: string;
  data: string;
  timestamp: number;
  provenance: {
    finalized: boolean;
    attestationCount: number;
    txSignature: string;
    slot: number;
  };
}

interface Attestation {
  validator: string;
  confidence: number;
  timestamp: number;
}

interface Peer {
  addr: string;
  nodeId: string;
  version: string;
}

interface Metrics {
  catalogSize: number;
  syncProgress: number;
  anchoringLatency: number;
}

interface IndexItem {
  cid: string;
  content: string;
  tags: string[];
  lineage: string[];
  confidence: number;
}

interface LineageItem {
  cid: string;
  type: string;
  timestamp?: number;
  validator?: string;
  confidence?: number;
  relation?: string;
}

// Prometheus metrics
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics();
}

const authFailures = new Counter({
  name: 'neuroswarm_auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['type']
});

const apiRequests = new Counter({
  name: 'neuroswarm_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status']
});

const apiRequestDuration = new Histogram({
  name: 'neuroswarm_api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const peerAccess = new Counter({
  name: 'neuroswarm_peer_access_total',
  help: 'Total number of peer list accesses',
  labelNames: ['username']
});

// Agent Registry Service
const agentRegistry = new AgentRegistryService();

// New Agent Registry and Discovery System (Feature 5)
const agentRegistryCore = new AgentRegistry();
const agentDiscovery = new AgentDiscoveryService(agentRegistryCore);

// Secure Communication Framework (Feature 6)
const secureCommunication = new SecureCommunicationFramework(agentRegistryCore);

// Consensus Engine (Feature 2)
const consensusEngine = new ConsensusEngine(secureCommunication, agentRegistryCore);

// Tokenomics Engine (Feature 3)
const tokenomicsEngine = new TokenomicsEngine(secureCommunication, agentRegistryCore);

// Swarm Intelligence Coordinator (Feature 7)
const swarmCoordinator = new SwarmCoordinator(secureCommunication, agentRegistryCore);

// Periodic cleanup of inactive agents (keep handle to clear on shutdown)
let agentRegistryCleanupInterval: NodeJS.Timeout | null = null;
if (process.env.NODE_ENV !== 'test') {
  agentRegistryCleanupInterval = setInterval(() => {
    agentRegistry.cleanup();
  }, 60000); // Clean up every minute
}

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

// Trust proxy - needed for rate limiting behind proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs - increased for dashboard polling
});
app.use(limiter);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    apiRequests.inc({
      method: req.method,
      endpoint: req.route?.path || req.path,
      status: res.statusCode.toString()
    });
    apiRequestDuration.observe({
      method: req.method,
      endpoint: req.route?.path || req.path
    }, duration);
  });
  next();
});

// Auth middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[AUTH] Headers for ${req.path}:`, JSON.stringify(req.headers));
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    console.log(`[AUTH] Access denied: missing token from ${req.ip} for ${req.path}`);
    authFailures.inc({ type: 'missing_token' });
    return res.status(401).json({ error: "Access denied" });
  }
  try {
    const verified = jwt.verify(token, JWT_SECRET) as User;
    (req as express.Request & { user: User }).user = verified;
    next();
  } catch (error) {
    console.log(`[AUTH] Invalid token from ${req.ip} for ${req.path}: ${error}`);
    authFailures.inc({ type: 'invalid_token' });
    res.status(400).json({ error: "Invalid token" });
  }
};

// Auth routes
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  // Mock authentication - in real implementation, check against database
  if (username === "admin" && password === "password") {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Mock data - in real implementation, connect to neuro-infra storage
const mockManifests: Record<string, Manifest> = {
  "QmTest123": {
    cid: "QmTest123",
    data: "mock data",
    timestamp: Date.now(),
    provenance: {
      finalized: true,
      attestationCount: 3,
      txSignature: "abc123",
      slot: 12345,
    },
  },
};

const mockAttestations: Record<string, Attestation[]> = {
  "QmTest123": [
    { validator: "val1", confidence: 95, timestamp: Date.now() },
    { validator: "val2", confidence: 90, timestamp: Date.now() },
  ],
};

const mockPeers: Peer[] = [
  { addr: "127.0.0.1:8080", nodeId: "node1", version: "0.1.0" },
];

const mockMetrics: Metrics = {
  catalogSize: 150,
  syncProgress: 85,
  anchoringLatency: 120,
};

// Routes
app.get("/v1/manifests/:cid", (req, res) => {
  const { cid } = req.params;
  const manifest = mockManifests[cid];
  if (!manifest) {
    return res.status(404).json({ error: "Manifest not found" });
  }
  res.json(manifest);
});

app.get("/v1/attestations/:cid", authenticate, (req, res) => {
  const { cid } = req.params;
  const attestations = mockAttestations[cid] || [];
  res.json({ attestations });
});

app.get("/v1/peers", authenticate, (req, res) => {
  const user = (req as express.Request & { user: User }).user;
  console.log(`[PEERS] Access by ${user.username} from ${req.ip}`);
  peerAccess.inc({ username: user.username });
  res.json({ peers: mockPeers });
});

app.get("/v1/metrics", authenticate, (req, res) => {
  res.json(mockMetrics);
});

// Mock index data
const mockIndex: Record<string, IndexItem> = {
  "QmTest123": {
    cid: "QmTest123",
    content: "neural network model data",
    tags: ["ai", "model"],
    lineage: ["QmParent1", "QmParent2"],
    confidence: 92,
  },
  "QmParent1": {
    cid: "QmParent1",
    content: "training dataset",
    tags: ["data", "training"],
    lineage: [],
    confidence: 95,
  },
};

const mockLineage: Record<string, LineageItem[]> = {
  "QmTest123": [
    { cid: "QmTest123", type: "manifest", timestamp: Date.now() },
    { cid: "QmAttest1", type: "attestation", validator: "val1", confidence: 95 },
    { cid: "QmParent1", type: "dependency", relation: "trained_on" },
  ],
};

// Indexer routes
app.get("/v1/index/search", (req, res) => {
  const { q, tag } = req.query;
  let results: IndexItem[] = Object.values(mockIndex);

  if (q) {
    results = results.filter((item: IndexItem) =>
      item.content.toLowerCase().includes((q as string).toLowerCase())
    );
  }

  if (tag) {
    results = results.filter((item: IndexItem) => item.tags.includes(tag as string));
  }

  res.json({ results, total: results.length });
});

app.get("/v1/index/lineage/:cid", (req, res) => {
  const { cid } = req.params;
  const lineage = mockLineage[cid] || [];
  res.json({ lineage });
});

app.get("/v1/index/confidence/:cid", (req, res) => {
  const { cid } = req.params;
  const item = mockIndex[cid];
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Aggregate confidence from attestations
  const attestations = mockAttestations[cid] || [];
  const avgConfidence = attestations.length > 0
    ? attestations.reduce((sum: number, att: Attestation) => sum + att.confidence, 0) / attestations.length
    : 0;

  res.json({
    cid,
    overallConfidence: Math.round(avgConfidence),
    attestationCount: attestations.length,
    anchoringStatus: item.confidence > 90 ? "high" : "medium",
  });
});

// Agent Registry API endpoints
app.post("/v1/agents/register", async (req, res) => {
  try {
    const registrationRequest = req.body;
    const result = await agentRegistry.registerAgent(registrationRequest);
    if (result.success) {
      res.status(201).json({ agentId: result.agentId });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/v1/agents/:agentId/heartbeat", async (req, res) => {
  try {
    const { agentId } = req.params;
    const result = await agentRegistry.updateAgentHeartbeat(agentId);
    if (result.success) {
      res.json({ status: 'ok' });
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    console.error('Agent heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/v1/agents/discover", async (req, res) => {
  try {
    const query = req.query;
    const result = await agentRegistry.discoverAgents(query);
    res.json(result);
  } catch (error) {
    console.error('Agent discovery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/v1/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentRegistry.getAgent(agentId);
    if (agent) {
      res.json(agent);
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    console.error('Agent retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put("/v1/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const updates = req.body;
    const result = await agentRegistry.updateAgent(agentId, updates);
    if (result.success) {
      res.json({ status: 'updated' });
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    console.error('Agent update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete("/v1/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const result = await agentRegistry.removeAgent(agentId);
    if (result.success) {
      res.json({ status: 'removed' });
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    console.error('Agent removal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/v1/swarms/coordinate", async (req, res) => {
  try {
    const coordinationRequest = req.body;
    const result = await agentRegistry.coordinateSwarm(coordinationRequest);
    if (result.success) {
      res.status(201).json({ swarm: result.swarm });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Swarm coordination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/v1/swarms/:swarmId", async (req, res) => {
  try {
    const { swarmId } = req.params;
    const swarm = await agentRegistry.getSwarm(swarmId);
    if (swarm) {
      res.json(swarm);
    } else {
      res.status(404).json({ error: 'Swarm not found' });
    }
  } catch (error) {
    console.error('Swarm retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New Agent Discovery API endpoints (Feature 5)
app.post("/v1/agents/discovery/register", async (req, res) => {
  try {
    const { id, capabilities, endpoints, metadata } = req.body;
    const registration = agentRegistryCore.registerAgent(id, capabilities, endpoints, metadata);
    res.status(201).json(registration);
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/v1/agents/discovery/:agentId/heartbeat", async (req, res) => {
  try {
    const { agentId } = req.params;
    agentRegistryCore.recordHeartbeat(agentId);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Agent heartbeat error:', error);
    res.status(404).json({ error: 'Agent not found' });
  }
});

app.get("/v1/agents/discovery/search", async (req, res) => {
  try {
    const query: DiscoveryQuery = {
      requiredCapabilities: req.query.capabilities ? (req.query.capabilities as string).split(',') : undefined,
      capabilityCategories: req.query.categories ? (req.query.categories as string).split(',').map(cat => cat as AgentCategory) : undefined,
      minReputation: req.query.minReputation ? parseFloat(req.query.minReputation as string) : undefined,
      maxLatency: req.query.maxLatency ? parseInt(req.query.maxLatency as string) : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: (req.query.sortBy as 'reputation' | 'totalTasks' | 'successRate' | 'latency') || 'reputation',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    };
    const result = agentDiscovery.discoverAgents(query);
    res.json(result);
  } catch (error) {
    console.error('Agent search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/v1/agents/discovery/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = agentRegistryCore.getAgent(agentId);
    if (agent) {
      res.json(agent);
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    console.error('Agent details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/v1/agents/discovery/capabilities", async (req, res) => {
  try {
    const allAgents = agentRegistryCore.getAllAgents();
    const capabilities = new Set<string>();
    allAgents.forEach(agent => {
      agent.capabilities.forEach(cap => capabilities.add(cap.id));
    });
    res.json({ capabilities: Array.from(capabilities) });
  } catch (error) {
    console.error('Capabilities retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/v1/agents/discovery/stats", async (req, res) => {
  try {
    const allAgents = agentRegistryCore.getAllAgents();
    const stats = {
      totalAgents: allAgents.length,
      activeAgents: allAgents.filter(a => a.status === 'active').length,
      inactiveAgents: allAgents.filter(a => a.status === 'inactive').length,
      registeringAgents: allAgents.filter(a => a.status === 'registering').length,
      totalCapabilities: new Set(allAgents.flatMap(a => a.capabilities.map(c => c.id))).size
    };
    res.json(stats);
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put("/v1/agents/discovery/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { capabilities, metadata } = req.body;
    if (capabilities) {
      agentRegistryCore.updateCapabilities(agentId, capabilities);
    }
    if (metadata) {
      // For metadata updates, we'd need to add an updateMetadata method
      // For now, we'll just update the agent status if provided
      if (req.body.status) {
        agentRegistryCore.updateAgentStatus(agentId, req.body.status);
      }
    }
    res.json({ status: 'updated' });
  } catch (error) {
    console.error('Agent update error:', error);
    res.status(404).json({ error: 'Agent not found' });
  }
});

app.delete("/v1/agents/discovery/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    agentRegistryCore.unregisterAgent(agentId);
    res.json({ status: 'deregistered' });
  } catch (error) {
    console.error('Agent deregistration error:', error);
    res.status(404).json({ error: 'Agent not found' });
  }
});

// Secure Communication API endpoints (Feature 6)
app.post("/v1/communication/channels/:peerId", authenticate, async (req, res) => {
  try {
    const { peerId } = req.params;
    const channel = await secureCommunication.establishConnection(peerId);
    res.status(201).json({
      peerId,
      established: channel.authenticated,
      encryptionKey: channel.encryptionKey.toString('hex'),
      protocolVersion: channel.protocolVersion
    });
  } catch (error) {
    console.error('Channel establishment error:', error);
    res.status(500).json({ error: 'Failed to establish secure channel' });
  }
});

app.post("/v1/communication/messages", authenticate, async (req, res) => {
  try {
    const { recipientId, payload, ttl } = req.body;
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: (req as express.Request & { user: User }).user.username, // Use authenticated user as sender
      recipientId,
      payload,
      timestamp: new Date(),
      ttl: ttl || 300000 // 5 minutes default
    };

    const receipt = await secureCommunication.sendMessage(message);
    res.status(201).json(receipt);
  } catch (error) {
    console.error('Message sending error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post("/v1/communication/broadcast", authenticate, async (req, res) => {
  try {
    const { recipients, payload, ttl } = req.body;
    const message = {
      id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: (req as express.Request & { user: User }).user.username,
      recipientId: '', // Will be set for each recipient
      payload,
      timestamp: new Date(),
      ttl: ttl || 300000
    };

    await secureCommunication.broadcastMessage(message, recipients);
    res.status(201).json({ status: 'broadcast_sent', recipientCount: recipients.length });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

app.get("/v1/communication/channels/:peerId", authenticate, async (req, res) => {
  try {
    const { peerId } = req.params;
    const channel = secureCommunication['channels'].get(peerId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json({
      peerId,
      authenticated: channel.authenticated,
      protocolVersion: channel.protocolVersion,
      lastActivity: channel.lastActivity,
      messageQueueLength: channel.messageQueue.length
    });
  } catch (error) {
    console.error('Channel status error:', error);
    res.status(500).json({ error: 'Failed to get channel status' });
  }
});

// Chat handler: forward to neuro-runner (AI Bridge)
app.post('/v1/chat', authenticate, async (req, res) => {
  const runnerUrl = process.env.RUNNER_URL || 'http://localhost:3002';
  try {
    const { content, model } = req.body;
    const user = (req as any).user;

    console.log(`[CHAT] Forwarding message from ${user.username} to runner at ${runnerUrl}`);

    const runnerRes = await fetch(`${runnerUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, model })
    });

    if (!runnerRes.ok) {
      const errorText = await runnerRes.text();
      console.error(`[CHAT] Runner error: ${errorText}`);
      return res.status(runnerRes.status).json({ error: 'AI processing failed', detail: errorText });
    }

    const data = await runnerRes.json();
    return res.json(data);

  } catch (err: any) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
});

// Chat history route
app.get('/v1/chat/history', authenticate, async (req, res) => {
  try {
    // Return mock history
    const history = [
      { sender: 'system', content: 'Welcome to NeuroSwarm. System online.', timestamp: Date.now() - 100000 },
      { sender: 'ai', content: 'Hello! I am ready to assist you.', timestamp: Date.now() - 50000 }
    ];
    return res.json(history);
  } catch (err: any) {
    console.error('Chat history error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
});

// Data adapter query endpoint - for real-time data (NBA scores, weather, etc.)
app.post('/v1/adapter/query', authenticate, async (req, res) => {
  try {
    const { adapter, params } = req.body;

    if (!adapter) {
      return res.status(400).json({ error: 'Adapter name required' });
    }

    console.log(`[ADAPTER] Querying adapter: ${adapter} with params:`, params);

    // Import the sources module dynamically
    const sourcesPath = '../../neuroswarm/sources/index.js';
    const sources = await import(sourcesPath);

    // Query the adapter
    const result = await sources.queryAdapter(adapter, params || {});

    console.log(`[ADAPTER] Result from ${adapter}:`, result);

    return res.json({
      success: true,
      adapter,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Adapter query error:', err);
    return res.status(500).json({
      error: 'Adapter query failed',
      detail: err?.message,
      adapter: req.body?.adapter
    });
  }
});

app.get("/v1/communication/metrics", authenticate, (req, res) => {
  try {
    const metrics = secureCommunication.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({ error: 'Failed to get communication metrics' });
  }
});

app.delete("/v1/communication/channels/:peerId", authenticate, (req, res) => {
  try {
    const { peerId } = req.params;
    secureCommunication.closeChannel(peerId);
    res.json({ status: 'channel_closed' });
  } catch (error) {
    console.error('Channel closure error:', error);
    res.status(500).json({ error: 'Failed to close channel' });
  }
});

// Consensus API endpoints (Feature 2)
app.post("/v1/consensus/proposals", authenticate, async (req, res) => {
  try {
    const { targetAgent, validationType, evidence, stakeRequirement, deadline } = req.body;
    const proposalId = await consensusEngine.proposeValidation({
      proposerId: (req as express.Request & { user: User }).user.username,
      targetAgent,
      validationType,
      evidence: evidence || [],
      stakeRequirement: stakeRequirement || 100,
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    res.status(201).json({ proposalId });
  } catch (error) {
    console.error('Consensus proposal error:', error);
    res.status(500).json({ error: 'Failed to create consensus proposal' });
  }
});

app.post("/v1/consensus/proposals/:proposalId/votes", authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { vote, stake, reasoning } = req.body;
    await consensusEngine.castVote({
      proposalId,
      voterId: (req as express.Request & { user: User }).user.username,
      vote,
      stake: stake || 100,
      reasoning
    });
    res.json({ status: 'vote_cast' });
  } catch (error) {
    console.error('Consensus voting error:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

app.get("/v1/consensus/proposals/:proposalId", authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const outcome = await consensusEngine.getConsensusOutcome(proposalId);
    const stats = consensusEngine.getVotingStats(proposalId);
    res.json({ outcome, stats });
  } catch (error) {
    console.error('Consensus query error:', error);
    res.status(500).json({ error: 'Failed to get consensus data' });
  }
});

app.get("/v1/consensus/proposals/active", authenticate, (req, res) => {
  try {
    const proposals = consensusEngine.getActiveProposals();
    res.json({ proposals });
  } catch (error) {
    console.error('Active proposals query error:', error);
    res.status(500).json({ error: 'Failed to get active proposals' });
  }
});

app.get("/v1/consensus/metrics", authenticate, (req, res) => {
  try {
    const metrics = consensusEngine.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Consensus metrics error:', error);
    res.status(500).json({ error: 'Failed to get consensus metrics' });
  }
});

// Tokenomics API endpoints (Feature 3)
app.post("/v1/tokenomics/proposals", authenticate, async (req, res) => {
  try {
    const { projectId, title, description, requestedAmount, category, evidence, deadline } = req.body;
    const proposalId = await tokenomicsEngine.submitFundingProposal({
      proposerId: (req as express.Request & { user: User }).user.username,
      projectId,
      title,
      description,
      requestedAmount,
      category: category || 'development',
      evidence: evidence || [],
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    res.status(201).json({ proposalId });
  } catch (error) {
    console.error('Tokenomics proposal error:', error);
    res.status(500).json({ error: 'Failed to submit funding proposal' });
  }
});

app.post("/v1/tokenomics/proposals/:proposalId/contribute", authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { amount } = req.body;
    await tokenomicsEngine.contributeToProposal({
      proposalId,
      contributorId: (req as express.Request & { user: User }).user.username,
      amount
    });
    res.json({ status: 'contribution_accepted' });
  } catch (error) {
    console.error('Tokenomics contribution error:', error);
    res.status(500).json({ error: 'Failed to process contribution' });
  }
});

app.post("/v1/tokenomics/proposals/:proposalId/calculate", authenticate, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const result = await tokenomicsEngine.calculateQuadraticFunding(proposalId);
    res.json(result);
  } catch (error) {
    console.error('Tokenomics calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate quadratic funding' });
  }
});

app.get("/v1/tokenomics/proposals/:proposalId", authenticate, (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = tokenomicsEngine.getFundingProposal(proposalId);
    const contributions = tokenomicsEngine.getContributions(proposalId);
    const result = tokenomicsEngine.getFundingResult(proposalId);
    res.json({ proposal, contributions, result });
  } catch (error) {
    console.error('Tokenomics query error:', error);
    res.status(500).json({ error: 'Failed to get funding data' });
  }
});

app.get("/v1/tokenomics/proposals/active", authenticate, (req, res) => {
  try {
    const proposals = tokenomicsEngine.getActiveProposals();
    res.json({ proposals });
  } catch (error) {
    console.error('Active funding proposals query error:', error);
    res.status(500).json({ error: 'Failed to get active proposals' });
  }
});

app.get("/v1/tokenomics/metrics", authenticate, (req, res) => {
  try {
    const metrics = tokenomicsEngine.getMetrics();
    const report = tokenomicsEngine.generateTransparencyReport();
    res.json({ metrics, transparencyReport: report });
  } catch (error) {
    console.error('Tokenomics metrics error:', error);
    res.status(500).json({ error: 'Failed to get tokenomics metrics' });
  }
});

// Swarm Intelligence API endpoints (Feature 7)
app.post("/v1/swarm/tasks", authenticate, async (req, res) => {
  try {
    const { description, requirements, priority, deadline, dependencies, estimatedDuration, maxConcurrentAgents } = req.body;
    const taskId = await swarmCoordinator.registerTask({
      description,
      requirements: requirements || [],
      priority: priority || 'medium',
      deadline: deadline ? new Date(deadline) : undefined,
      dependencies: dependencies || [],
      estimatedDuration: estimatedDuration || 3600000, // 1 hour default
      maxConcurrentAgents: maxConcurrentAgents || 1
    });
    res.status(201).json({ taskId });
  } catch (error) {
    console.error('Swarm task registration error:', error);
    res.status(500).json({ error: 'Failed to register swarm task' });
  }
});

app.put("/v1/swarm/tasks/:taskId/progress", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { progress, status } = req.body;
    await swarmCoordinator.updateTaskProgress(
      taskId,
      (req as express.Request & { user: User }).user.username,
      progress,
      status
    );
    res.json({ status: 'progress_updated' });
  } catch (error) {
    console.error('Swarm progress update error:', error);
    res.status(500).json({ error: 'Failed to update task progress' });
  }
});

app.get("/v1/swarm/tasks/:taskId", authenticate, (req, res) => {
  try {
    const { taskId } = req.params;
    const task = swarmCoordinator.getTask(taskId);
    const allocations = swarmCoordinator.getTaskAllocations(taskId);
    res.json({ task, allocations });
  } catch (error) {
    console.error('Swarm task query error:', error);
    res.status(500).json({ error: 'Failed to get task data' });
  }
});

app.get("/v1/swarm/tasks", authenticate, (req, res) => {
  try {
    const { status } = req.query;
    let tasks;
    if (status) {
      tasks = swarmCoordinator.getTasksByStatus(status as any);
    } else {
      tasks = swarmCoordinator.getAllTasks();
    }
    res.json({ tasks });
  } catch (error) {
    console.error('Swarm tasks query error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

app.get("/v1/swarm/agents/:agentId", authenticate, (req, res) => {
  try {
    const { agentId } = req.params;
    const agentState = swarmCoordinator.getAgentState(agentId);
    res.json({ agent: agentState });
  } catch (error) {
    console.error('Swarm agent query error:', error);
    res.status(500).json({ error: 'Failed to get agent state' });
  }
});

app.get("/v1/swarm/metrics", authenticate, (req, res) => {
  try {
    const metrics = swarmCoordinator.getSwarmMetrics();
    const agents = swarmCoordinator.getAllAgentStates();
    res.json({ metrics, agents });
  } catch (error) {
    console.error('Swarm metrics error:', error);
    res.status(500).json({ error: 'Failed to get swarm metrics' });
  }
});

// Metrics endpoint for Prometheus
app.get("/metrics", async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Shutdown helper
export async function shutdown(): Promise<void> {
  console.log('Shutting down Neuro Services Gateway (shutdown() called)...');
  try {
    agentRegistry.cleanup();
    agentRegistry.destroy?.();
    agentRegistryCore.destroy?.();
    secureCommunication.destroy?.();
    consensusEngine.destroy?.();
    tokenomicsEngine?.destroy?.();
    swarmCoordinator.destroy?.();
    if (agentRegistryCleanupInterval) {
      clearInterval(agentRegistryCleanupInterval);
      agentRegistryCleanupInterval = null;
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
}

// Clean shutdown via signals
process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

import { Server } from 'http';
export let server: Server | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`Neuro Services Gateway API listening on port ${port}`);
  });
}
export default app;