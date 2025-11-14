import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { collectDefaultMetrics, register, Counter, Histogram } from "prom-client";
import { AgentRegistryService } from "./agent-registry";

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
collectDefaultMetrics();

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

// Periodic cleanup of inactive agents
setInterval(() => {
  agentRegistry.cleanup();
}, 60000); // Clean up every minute

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

app.get("/v1/swarms/:swarmId", async (req, res) => {
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

app.listen(port, () => {
  console.log(`Neuro Services Gateway API listening on port ${port}`);
});

export default app;