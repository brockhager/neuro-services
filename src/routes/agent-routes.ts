import { Router } from 'express';
import { AgentRegistryService } from '../agent-registry.js';

export function createAgentRoutes(agentRegistry: AgentRegistryService): Router {
    const router = Router();

    router.post("/v1/agents/register", async (req, res) => {
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

    router.post("/v1/agents/:agentId/heartbeat", async (req, res) => {
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

    router.get("/v1/agents/discover", async (req, res) => {
        try {
            const query = req.query;
            const result = await agentRegistry.discoverAgents(query);
            res.json(result);
        } catch (error) {
            console.error('Agent discovery error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get("/v1/agents/:agentId", async (req, res) => {
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

    router.put("/v1/agents/:agentId", async (req, res) => {
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

    router.delete("/v1/agents/:agentId", async (req, res) => {
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

    return router;
}
