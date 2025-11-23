import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { collectDefaultMetrics, Counter, Histogram } from "prom-client";
import { AgentRegistryService } from "./agent-registry.js";
import { AgentRegistry, AgentDiscoveryService } from "./agent-registry/index.js";
import { SecureCommunicationFramework } from "./communication/index.js";
import { ConsensusEngine } from "./consensus/consensus-engine.js";
import { TokenomicsEngine } from "./tokenomics/tokenomics-engine.js";
import { SwarmCoordinator } from "./swarm-intelligence/swarm-coordinator.js";
import { LearningService } from "./learning/learning-service.js";

// Import route modules
import { createLearningRoutes } from "./routes/learning-routes.js";
import { createMetricsRoutes } from "./routes/metrics-routes.js";
import { createAgentRoutes } from "./routes/agent-routes.js";
import { createSwarmRoutes } from "./routes/swarm-routes.js";
import { createConsensusRoutes } from "./routes/consensus-routes.js";
import { createTokenomicsRoutes } from "./routes/tokenomics-routes.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createChatRoutes } from "./routes/chat-routes.js";

// Types
interface User { username: string; }

// Metrics
if (process.env.NODE_ENV !== "test") { collectDefaultMetrics(); }
const authFailures = new Counter({ name: "neuroswarm_auth_failures_total", help: "Total authentication failures", labelNames: ["type"] });
const apiRequests = new Counter({ name: "neuroswarm_api_requests_total", help: "Total API requests", labelNames: ["method", "endpoint", "status"] });
const apiRequestDuration = new Histogram({ name: "neuroswarm_api_request_duration_seconds", help: "API request duration", labelNames: ["method", "endpoint"], buckets: [0.1, 0.5, 1, 2, 5] });

// Core services
const agentRegistry = new AgentRegistryService();
const agentRegistryCore = new AgentRegistry();
const agentDiscovery = new AgentDiscoveryService(agentRegistryCore);
const secureCommunication = new SecureCommunicationFramework(agentRegistryCore);
const consensusEngine = new ConsensusEngine(secureCommunication, agentRegistryCore);
const tokenomicsEngine = new TokenomicsEngine(secureCommunication, agentRegistryCore);
const swarmCoordinator = new SwarmCoordinator(secureCommunication, agentRegistryCore);
const learningService = new LearningService();
learningService.ingestLogs().then(() => learningService.generateEmbeddings()).catch(err => console.error("Learning bootstrap error", err));

const app = express();
const port = process.env.PORT || 3007;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 }));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    apiRequests.inc({ method: req.method, endpoint: req.route?.path || req.path, status: res.statusCode.toString() });
    apiRequestDuration.observe({ method: req.method, endpoint: req.route?.path || req.path }, duration);
  });
  next();
});

// Auth middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) { authFailures.inc({ type: "missing_token" }); return res.status(401).json({ error: "Access denied" }); }
  try { const verified = jwt.verify(token, JWT_SECRET) as User; (req as any).user = verified; next(); }
  catch { authFailures.inc({ type: "invalid_token" }); return res.status(400).json({ error: "Invalid token" }); }
};

// Serve static welcome page and chat page
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public")));
app.get("/", (req, res) => { res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/index.html")); });
app.get("/chat", (req, res) => { res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/chat.html")); });

// Register API routes
app.use("/learning", createLearningRoutes(learningService));
app.use("/metrics", createMetricsRoutes());
app.use("/agents", createAgentRoutes(agentRegistry));
app.use("/swarm", createSwarmRoutes(swarmCoordinator, authenticate));
app.use("/consensus", createConsensusRoutes(consensusEngine, secureCommunication, authenticate));
app.use("/tokenomics", createTokenomicsRoutes(tokenomicsEngine, authenticate));
app.use("/auth", createAuthRoutes());
app.use("/", createChatRoutes());

// Simple health endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(port, () => console.log(`NeuroSwarm service listening on port ${port}`));