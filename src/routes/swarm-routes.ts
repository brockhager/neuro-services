import { Router, Request } from 'express';
import { SwarmCoordinator } from '../swarm-intelligence/swarm-coordinator.js';

interface User {
    username: string;
}

export function createSwarmRoutes(swarmCoordinator: SwarmCoordinator, authenticate: any): Router {
    const router = Router();

    router.post("/v1/swarm/tasks", authenticate, async (req, res) => {
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

    router.put("/v1/swarm/tasks/:taskId/progress", authenticate, async (req, res) => {
        try {
            const { taskId } = req.params;
            const { progress, status } = req.body;
            await swarmCoordinator.updateTaskProgress(
                taskId,
                (req as any).user.username,
                progress,
                status
            );
            res.json({ status: 'progress_updated' });
        } catch (error) {
            console.error('Swarm progress update error:', error);
            res.status(500).json({ error: 'Failed to update task progress' });
        }
    });

    router.get("/v1/swarm/tasks/:taskId", authenticate, (req, res) => {
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

    router.get("/v1/swarm/tasks", authenticate, (req, res) => {
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

    router.get("/v1/swarm/agents/:agentId", authenticate, (req, res) => {
        try {
            const { agentId } = req.params;
            const agentState = swarmCoordinator.getAgentState(agentId);
            res.json({ agent: agentState });
        } catch (error) {
            console.error('Swarm agent query error:', error);
            res.status(500).json({ error: 'Failed to get agent state' });
        }
    });

    router.get("/v1/swarm/metrics", authenticate, (req, res) => {
        try {
            const metrics = swarmCoordinator.getSwarmMetrics();
            const agents = swarmCoordinator.getAllAgentStates();
            res.json({ metrics, agents });
        } catch (error) {
            console.error('Swarm metrics error:', error);
            res.status(500).json({ error: 'Failed to get swarm metrics' });
        }
    });

    // Check if a node is connected
    router.get("/v1/swarm/nodes/:nodeId/connected", authenticate, (req, res) => {
        try {
            const { nodeId } = req.params;
            const isConnected = swarmCoordinator.isNodeConnected(nodeId);
            res.json({ connected: isConnected });
        } catch (error) {
            console.error('Swarm node connection check error:', error);
            res.status(500).json({ error: 'Failed to check node connection' });
        }
    });

    return router;
}
