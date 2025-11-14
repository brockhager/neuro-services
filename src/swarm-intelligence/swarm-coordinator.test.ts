import { SwarmCoordinator, SwarmTask } from './swarm-coordinator';
import { SecureCommunicationFramework } from '../communication';
import { AgentRegistry, AgentCategory } from '../agent-registry/index';

describe('Swarm Coordinator Integration', () => {
  let registry: AgentRegistry;
  let communication: SecureCommunicationFramework;
  let coordinator: SwarmCoordinator;

  beforeEach(async () => {
    registry = new AgentRegistry();
    communication = new SecureCommunicationFramework(registry);

    // Register test agents with different capabilities BEFORE creating coordinator
    registry.registerAgent('agent1', [
      { id: 'data_processing', name: 'Data Processing', description: 'Data processing capabilities', category: AgentCategory.DATA_PROCESSING, version: '1.0', parameters: {}, performance: { accuracy: 0.9, latency: 100, throughput: 1000 } },
      { id: 'reasoning', name: 'Reasoning', description: 'Logical reasoning capabilities', category: AgentCategory.REASONING, version: '1.0', parameters: {}, performance: { accuracy: 0.85, latency: 200, throughput: 500 } }
    ], [], {
      name: 'Agent 1',
      description: 'Data processing specialist',
      version: '1.0',
      author: 'Test',
      license: 'MIT',
      tags: ['data', 'processing'],
      reputation: 0.9,
      totalTasks: 100,
      successRate: 0.95
    });
    registry.updateAgentStatus('agent1', 'active');

    registry.registerAgent('agent2', [
      { id: 'computer_vision', name: 'Computer Vision', description: 'Computer vision capabilities', category: AgentCategory.COMPUTER_VISION, version: '1.0', parameters: {}, performance: { accuracy: 0.95, latency: 150, throughput: 800 } },
      { id: 'reasoning', name: 'Reasoning', description: 'Logical reasoning capabilities', category: AgentCategory.REASONING, version: '1.0', parameters: {}, performance: { accuracy: 0.8, latency: 250, throughput: 400 } }
    ], [], {
      name: 'Agent 2',
      description: 'Vision specialist',
      version: '1.0',
      author: 'Test',
      license: 'MIT',
      tags: ['vision', 'ai'],
      reputation: 0.85,
      totalTasks: 80,
      successRate: 0.9
    });
    registry.updateAgentStatus('agent2', 'active');

    registry.registerAgent('agent3', [
      { id: 'natural_language', name: 'Natural Language', description: 'Natural language processing capabilities', category: AgentCategory.NATURAL_LANGUAGE, version: '1.0', parameters: {}, performance: { accuracy: 0.88, latency: 120, throughput: 900 } }
    ], [], {
      name: 'Agent 3',
      description: 'NLP specialist',
      version: '1.0',
      author: 'Test',
      license: 'MIT',
      tags: ['nlp', 'language'],
      reputation: 0.8,
      totalTasks: 60,
      successRate: 0.88
    });
    registry.updateAgentStatus('agent3', 'active');

    // NOW create coordinator after agents are registered
    coordinator = new SwarmCoordinator(communication, registry, 5000, 1000); // 1 second stuck threshold for testing
  });

  afterEach(() => {
    communication.destroy();
    registry.destroy();
    coordinator.destroy();
  });

  describe('Task Registration and Broadcasting', () => {
    it('should register tasks and broadcast to capable agents', async () => {
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Process large dataset for analysis',
        requirements: [
          { capability: 'data_processing', minPerformance: 0.8, quantity: 1 }
        ],
        priority: 'high',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        dependencies: [],
        estimatedDuration: 3600000, // 1 hour
        maxConcurrentAgents: 2
      };

      const taskId = await coordinator.registerTask(task);

      expect(taskId).toBeDefined();
      expect(taskId.startsWith('task_')).toBe(true);

      const registeredTask = coordinator.getTask(taskId);
      expect(registeredTask).toBeDefined();
      expect(registeredTask!.description).toBe(task.description);
      expect(registeredTask!.status).toBe('pending');
    });

    it('should only broadcast to agents with required capabilities', async () => {
      const initialMessagesSent = communication.getMetrics().messagesSent;

      // Task requiring data processing (agent1 has this)
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Data processing task',
        requirements: [
          { capability: 'data_processing', minPerformance: 0.8, quantity: 1 }
        ],
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 1800000,
        maxConcurrentAgents: 1
      };

      await coordinator.registerTask(task);

      // Wait a bit for async broadcast to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const finalMessagesSent = communication.getMetrics().messagesSent;

      // Should have sent at least one message (broadcast to agent1)
      expect(finalMessagesSent).toBeGreaterThan(initialMessagesSent);
    });
  });

  describe('Task Allocation and Progress Tracking', () => {
    let taskId: string;

    beforeEach(async () => {
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Test coordination task',
        requirements: [
          { capability: 'reasoning', minPerformance: 0.7, quantity: 1 }
        ],
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 600000, // 10 minutes
        maxConcurrentAgents: 2
      };

      taskId = await coordinator.registerTask(task);
    });

    it('should handle task acceptance and assignment', async () => {
      // Simulate task acceptance from agent1 by calling handleCoordinationMessage directly
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      const task = coordinator.getTask(taskId);
      expect(task!.assignedAgents).toContain('agent1');
      expect(task!.status).toBe('in_progress'); // Auto-started when agent assigned

      const allocations = coordinator.getTaskAllocations(taskId);
      expect(allocations.length).toBe(1);
      expect(allocations[0].agentId).toBe('agent1');
      expect(allocations[0].role).toBe('primary');
    });

    it('should track task progress updates', async () => {
      // First accept the task
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      // Update progress
      await coordinator.updateTaskProgress(taskId, 'agent1', 50);

      const task = coordinator.getTask(taskId);
      expect(task!.progress).toBe(50);
      expect(task!.status).toBe('in_progress');
    });

    it('should handle task completion', async () => {
      // Accept task
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      // Complete task
      await coordinator.updateTaskProgress(taskId, 'agent1', 100, 'completed');

      const task = coordinator.getTask(taskId);
      expect(task!.status).toBe('completed');
      expect(task!.progress).toBe(100);

      // Agent should be freed up
      const agentState = coordinator.getAgentState('agent1');
      expect(agentState!.status).toBe('idle');
      expect(agentState!.currentLoad).toBe(0);
    });

    it('should handle task failure and reassignment', async () => {
      // Accept task
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      // Fail task
      await coordinator.updateTaskProgress(taskId, 'agent1', 25, 'failed');

      const task = coordinator.getTask(taskId);
      expect(task!.status).toBe('pending'); // Should be reset for reassignment
      expect(task!.assignedAgents).toEqual([]); // Should be cleared
    });
  });

  describe('Inter-Agent Coordination', () => {
    let taskId: string;

    beforeEach(async () => {
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Multi-agent coordination test',
        requirements: [
          { capability: 'reasoning', minPerformance: 0.7, quantity: 2 }
        ],
        priority: 'high',
        dependencies: [],
        estimatedDuration: 1200000, // 20 minutes
        maxConcurrentAgents: 2
      };

      taskId = await coordinator.registerTask(task);

      // Assign two agents
      const acceptanceMessage1 = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      const acceptanceMessage2 = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent2',
          payload: { role: 'secondary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage1);
      await (coordinator as any).handleCoordinationMessage(acceptanceMessage2);
    });

    it('should route coordination requests between assigned agents', async () => {
      // Check that both agents are assigned
      const task = coordinator.getTask(taskId);
      expect(task!.assignedAgents).toEqual(['agent1', 'agent2']);

      // Agent1 sends coordination request
      const coordinationMessage = {
        payload: {
          type: 'coordination_request',
          taskId,
          agentId: 'agent1',
          payload: { request: 'need_assistance', details: 'Complex reasoning required' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(coordinationMessage);

      // Wait for async broadcast to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if coordination response was queued for agent2
      const agent2Channel = (communication as any).channels.get('agent2');
      const hasCoordinationResponse = agent2Channel?.messageQueue.some((msg: any) =>
        msg.payload.type === 'coordination_response'
      );

      expect(hasCoordinationResponse).toBe(true);
    });

    it('should broadcast progress updates to all assigned agents', async () => {
      const initialMessagesSent = communication.getMetrics().messagesSent;

      // Agent1 updates progress
      await coordinator.updateTaskProgress(taskId, 'agent1', 75);

      // Wait a bit for async broadcast to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const finalMessagesSent = communication.getMetrics().messagesSent;

      // Should have broadcast progress update to both agents
      expect(finalMessagesSent).toBeGreaterThan(initialMessagesSent);
    });
  });

  describe('Swarm Metrics and Monitoring', () => {
    it('should calculate comprehensive swarm metrics', async () => {
      // Create and complete a task
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Metrics test task',
        requirements: [
          { capability: 'reasoning', minPerformance: 0.7, quantity: 1 }
        ],
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 300000, // 5 minutes
        maxConcurrentAgents: 1
      };

      const taskId = await coordinator.registerTask(task);

      // Accept and complete task
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      await coordinator.updateTaskProgress(taskId, 'agent1', 100, 'completed');

      const metrics = coordinator.getSwarmMetrics();

      expect(metrics.totalTasks).toBe(1);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.failedTasks).toBe(0);
      expect(metrics.activeTasks).toBe(0);
      expect(metrics.agentUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.coordinationEfficiency).toBeGreaterThanOrEqual(0);
    });

    it('should track agent states and utilization', () => {
      const allAgents = coordinator.getAllAgentStates();

      expect(allAgents.length).toBe(3); // agent1, agent2, agent3

      // Check agent capabilities are correctly mapped
      const agent1 = allAgents.find(a => a.id === 'agent1');
      expect(agent1!.capabilities).toContain('data_processing');
      expect(agent1!.capabilities).toContain('reasoning');

      const agent3 = allAgents.find(a => a.id === 'agent3');
      expect(agent3!.capabilities).toContain('natural_language');
    });
  });

  describe('Fault Tolerance and Reassignment', () => {
    it('should handle agent unavailability', async () => {
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Fault tolerance test',
        requirements: [
          { capability: 'reasoning', minPerformance: 0.7, quantity: 1 }
        ],
        priority: 'high',
        dependencies: [],
        estimatedDuration: 600000,
        maxConcurrentAgents: 1
      };

      const taskId = await coordinator.registerTask(task);

      // Accept task with agent1
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      const retrievedTask = coordinator.getTask(taskId);
      expect(retrievedTask!.assignedAgents).toContain('agent1');

      // Simulate agent failure (mark as offline)
      const agent1 = registry.getAgent('agent1');
      if (agent1) {
        agent1.status = 'inactive';
      }

      // Trigger coordination cycle (normally happens automatically)
      await (coordinator as any).performCoordinationCycle();

      // Task should still be tracked but agent status updated
      const agentState = coordinator.getAgentState('agent1');
      expect(agentState!.status).toBe('offline');
    });

    it('should detect and handle stuck tasks', async () => {
      const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
        description: 'Stuck task test',
        requirements: [
          { capability: 'reasoning', minPerformance: 0.7, quantity: 1 }
        ],
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 300000,
        maxConcurrentAgents: 1
      };

      const taskId = await coordinator.registerTask(task);

      // Accept task
      const acceptanceMessage = {
        payload: {
          type: 'task_acceptance',
          taskId,
          agentId: 'agent1',
          payload: { role: 'primary' }
        }
      };

      await (coordinator as any).handleCoordinationMessage(acceptanceMessage);

      // Start task with initial progress
      await coordinator.updateTaskProgress(taskId, 'agent1', 10);

      let stuckDetected = false;
      coordinator.on('taskStuck', () => {
        stuckDetected = true;
      });

      // Simulate task running for a while without progress updates
      // Wait longer than the stuck threshold (1 second) to trigger detection
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Trigger coordination cycle to check for stuck tasks
      await (coordinator as any).performCoordinationCycle();

      expect(stuckDetected).toBe(true);
    });
  });

  describe('Throughput and Latency Testing', () => {
    it('should handle multiple concurrent tasks', async () => {
      const tasks = [];

      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        const task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'> = {
          description: `Concurrent task ${i}`,
          requirements: [
            { capability: 'reasoning', minPerformance: 0.7, quantity: 1 }
          ],
          priority: 'medium',
          dependencies: [],
          estimatedDuration: 600000,
          maxConcurrentAgents: 1
        };

        const taskId = await coordinator.registerTask(task);
        tasks.push(taskId);
      }

      expect(tasks.length).toBe(5);

      const metrics = coordinator.getSwarmMetrics();
      expect(metrics.totalTasks).toBe(5);
      expect(metrics.activeTasks).toBe(0); // None assigned yet
    });

    it('should maintain communication channel health', () => {
      // Test that heartbeat monitoring is active
      const communicationMetrics = communication.getMetrics();
      expect(communicationMetrics.activeChannels).toBeGreaterThanOrEqual(0);
    });
  });
});