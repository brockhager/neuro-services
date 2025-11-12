import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import Joi from "joi";

const app = express();
const port = process.env.PORT || 3000;

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

// Mock data - in real implementation, connect to neuro-infra storage
const mockManifests: Record<string, any> = {
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

const mockAttestations: Record<string, any[]> = {
  "QmTest123": [
    { validator: "val1", confidence: 95, timestamp: Date.now() },
    { validator: "val2", confidence: 90, timestamp: Date.now() },
  ],
};

const mockPeers = [
  { addr: "127.0.0.1:8080", nodeId: "node1", version: "0.1.0" },
];

const mockMetrics = {
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

app.get("/v1/attestations/:cid", (req, res) => {
  const { cid } = req.params;
  const attestations = mockAttestations[cid] || [];
  res.json({ attestations });
});

app.get("/v1/peers", (req, res) => {
  res.json({ peers: mockPeers });
});

app.get("/v1/metrics", (req, res) => {
  res.json(mockMetrics);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Neuro Services Gateway API listening on port ${port}`);
});

export default app;