import { EventEmitter } from 'events';
import { SecureCommunicationFramework } from '../communication/index.js';
import { AgentRegistry } from '../agent-registry/index.js';
import {
  SwarmTask,
  TaskRequirement,
  Agent,
  TaskAllocation,
  CoordinationMessage,
  SwarmMetrics
} from './types.js';

/**
 * Swarm Intelligence Coordination Engine
 * Implements decentralized task allocation and agent coordination using secure channels
 */
export class SwarmCoordinator extends EventEmitter {
  private tasks: Map<string, SwarmTask> = new Map();
  private coordinationIntervalHandle: NodeJS.Timeout | null = null;
  private onMessageHandler: ((message: any) => void) | null = null;
  private allocations: Map<string, TaskAllocation[]> = new Map();
  private agentStates: Map<string, Agent> = new Map();
  private coordinationHistory: CoordinationMessage[] = [];

  constructor(
    private communication: SecureCommunicationFramework,
    private registry: AgentRegistry,
    private coordinationInterval: number = 5000, // 5 seconds
    private stuckTaskThreshold: number = 300000 // 5 minutes - configurable for testing
  ) {
    super();

    // Listen for coordination messages
    this.onMessageHandler = (message: any) => this.handleCoordinationMessage(message);
    this.communication.on('messageReceived', this.onMessageHandler);

    // Start periodic coordination and keep handle to clear it on destroy
    this.coordinationIntervalHandle = setInterval(() => this.performCoordinationCycle(), coordinationInterval);

    // Initialize agent states
    this.initializeAgentStates();
  }

  /**
   * Register a new task for swarm coordination
   */
  async registerTask(task: Omit<SwarmTask, 'id' | 'status' | 'createdAt' | 'assignedAgents' | 'progress'>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullTask: SwarmTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
      assignedAgents: [],
      progress: 0
    };

    this.tasks.set(taskId, fullTask);
    this.allocations.set(taskId, []);

    // Broadcast task to available agents
    await this.broadcastTaskOffer(fullTask);

    this.emit('taskRegistered', fullTask);
    return taskId;
  }

  /**
   * Register a new node (e.g., a NS node coming online).
   * This creates an entry in the internal agentStates map so the GW can track it.
   * @param nodeId Unique identifier for the node.
   * @param capabilities List of capability strings the node supports.
   */
  public registerNode(nodeId: string, capabilities: string[] = []): void {
    if (this.agentStates.has(nodeId)) {
      // Node already known – just update capabilities and mark as idle
      const existing = this.agentStates.get(nodeId)!;
      existing.capabilities = capabilities;
      existing.status = 'idle';
      existing.lastActive = new Date();
      return;
    }
    const newNode: Agent = {
      id: nodeId,
      capabilities,
      currentLoad: 0,
      reputation: 1.0, // default good reputation
      lastActive: new Date(),
      status: 'idle'
    };
    this.agentStates.set(nodeId, newNode);
  }

  /**
   * Check if a node is connected (active within the last maxStaleMs milliseconds).
   * @param nodeId Unique identifier for the node.
   * @param maxStaleMs Maximum time in milliseconds since last activity to consider connected.
   */
  public isNodeConnected(nodeId: string, maxStaleMs: number = 30000): boolean {
    const agent = this.agentStates.get(nodeId);
    if (!agent) return false;
    const timeSinceLastActive = Date.now() - agent.lastActive.getTime();
    return timeSinceLastActive <= maxStaleMs;
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(taskId: string, agentId: string, progress: number, status?: SwarmTask['status']): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Verify agent is assigned to this task
    if (!task.assignedAgents.includes(agentId)) {
      throw new Error(`Agent ${agentId} is not assigned to task ${taskId}`);
    }

    task.progress = Math.max(0, Math.min(100, progress));

    if (status) {
      task.status = status;
    }

    // Broadcast progress update
    await this.broadcastProgressUpdate(taskId, agentId, progress, status);

    this.emit('taskProgressUpdated', { taskId, agentId, progress, status });

    // Check if task is complete
    if (task.progress >= 100 || status === 'completed') {
      await this.handleTaskCompletion(taskId);
    } else if (status === 'failed') {
      await this.handleTaskFailure(taskId);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SwarmTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): SwarmTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: SwarmTask['status']): SwarmTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get agent allocations for a task
   */
  getTaskAllocations(taskId: string): TaskAllocation[] {
    return this.allocations.get(taskId) || [];
  }

  /**
   * Get agent state
   */
  getAgentState(agentId: string): Agent | null {
    return this.agentStates.get(agentId) || null;
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): Agent[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * Calculate swarm metrics
   */
  getSwarmMetrics(): SwarmMetrics {
    const allTasks = Array.from(this.tasks.values());
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const failedTasks = allTasks.filter(t => t.status === 'failed');
    const activeTasks = allTasks.filter(t => ['assigned', 'in_progress'].includes(t.status));

    // Calculate average task duration
    let totalDuration = 0;
    let completedCount = 0;
    for (const task of completedTasks) {
      const allocations = this.allocations.get(task.id) || [];
      if (allocations.length > 0) {
        const startTime = Math.min(...allocations.map(a => a.assignedAt.getTime()));
        const endTime = task.createdAt.getTime() + task.estimatedDuration;
        totalDuration += (endTime - startTime);
        completedCount++;
      }
    }
    const averageTaskDuration = completedCount > 0 ? totalDuration / completedCount : 0;

    // Calculate agent utilization
    const allAgents = Array.from(this.agentStates.values());
    const busyAgents = allAgents.filter(a => a.status === 'busy').length;
    const agentUtilization = allAgents.length > 0 ? busyAgents / allAgents.length : 0;

    // Calculate coordination efficiency (tasks completed on time / total tasks)
    const onTimeTasks = completedTasks.filter(task => {
      const allocations = this.allocations.get(task.id) || [];
      if (allocations.length === 0) return false;
      const completionTime = Math.max(...allocations.map(a => a.expectedCompletion.getTime()));
      return !task.deadline || completionTime <= task.deadline.getTime();
    }).length;

    const coordinationEfficiency = allTasks.length > 0 ? onTimeTasks / allTasks.length : 0;

    return {
      totalTasks: allTasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      averageTaskDuration,
      agentUtilization,
      coordinationEfficiency,
      lastUpdate: new Date()
    };
  }

  /**
   * Broadcast task offer to available agents
   */
  private async broadcastTaskOffer(task: SwarmTask): Promise<void> {
    const availableAgents = this.getAvailableAgentsForTask(task);

    if (availableAgents.length === 0) {
      this.emit('noAgentsAvailable', { taskId: task.id });
      return;
    }

    const recipientIds = availableAgents.map(agent => agent.id);

    const message = {
      id: `task_offer_${task.id}`,
      senderId: 'swarm-coordinator',
      recipientId: '',
      payload: {
        type: 'task_offer',
        task
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL for task offers
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Broadcast progress update
   */
  private async broadcastProgressUpdate(taskId: string, agentId: string, progress: number, status?: SwarmTask['status']): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const recipientIds = task.assignedAgents;

    const message = {
      id: `progress_update_${taskId}_${agentId}_${Date.now()}`,
      senderId: agentId,
      recipientId: '',
      payload: {
        type: 'progress_update',
        taskId,
        agentId,
        progress,
        status,
        timestamp: new Date()
      },
      timestamp: new Date(),
      ttl: 60000 // 1 minute TTL for progress updates
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Handle incoming coordination messages
   */
  private async handleCoordinationMessage(message: any): Promise<void> {
    try {
      const { type, taskId, agentId, payload } = message.payload;

      const coordinationMessage: CoordinationMessage = {
        type: type as CoordinationMessage['type'],
        taskId,
        agentId,
        payload,
        timestamp: new Date(),
        priority: this.getMessagePriority(type)
      };

      this.coordinationHistory.push(coordinationMessage);

      switch (type) {
        case 'task_acceptance':
          await this.handleTaskAcceptance(taskId, agentId, payload);
          break;
        case 'task_rejection':
          await this.handleTaskRejection(taskId, agentId, payload);
          break;
        case 'progress_update':
          await this.handleProgressUpdate(taskId, agentId, payload);
          break;
        case 'coordination_request':
          await this.handleCoordinationRequest(taskId, agentId, payload);
          break;
      }

      this.emit('coordinationMessageReceived', coordinationMessage);
    } catch (error) {
      this.emit('coordinationMessageError', { message, error });
    }
  }

  /**
   * Handle task acceptance
   */
  private async handleTaskAcceptance(taskId: string, agentId: string, payload: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'pending' && task.status !== 'assigned' && task.status !== 'in_progress')) return;

    // Check if agent can be assigned
    const agent = this.agentStates.get(agentId);
    if (!agent || agent.status !== 'idle') return;

    // Check if we haven't exceeded max concurrent agents
    if (task.assignedAgents.length >= task.maxConcurrentAgents) return;

    // Assign agent to task
    task.assignedAgents.push(agentId);
    if (task.status === 'pending') {
      task.status = 'assigned';
    }
    agent.status = 'busy';
    agent.currentLoad += 1;

    // Create allocation record
    const allocation: TaskAllocation = {
      taskId,
      agentId,
      role: payload.role || 'primary',
      assignedAt: new Date(),
      expectedCompletion: new Date(Date.now() + task.estimatedDuration)
    };

    const allocations = this.allocations.get(taskId) || [];
    allocations.push(allocation);
    this.allocations.set(taskId, allocations);

    // Start the task if we have at least one agent assigned
    // Single-agent tasks start immediately, multi-agent tasks wait for more agents or when no more are available
    if (task.assignedAgents.length >= 1 && task.status !== 'in_progress') {
      task.status = 'in_progress';
      await this.broadcastTaskStart(task);
    }

    this.emit('taskAccepted', { taskId, agentId, allocation });
  }

  /**
   * Handle task rejection
   */
  private async handleTaskRejection(taskId: string, agentId: string, payload: any): Promise<void> {
    // Log rejection for future coordination decisions
    this.emit('taskRejected', { taskId, agentId, reason: payload.reason });
  }

  /**
   * Handle progress update
   */
  private async handleProgressUpdate(taskId: string, agentId: string, payload: any): Promise<void> {
    await this.updateTaskProgress(taskId, agentId, payload.progress, payload.status);
  }

  /**
   * Handle coordination request
   */
  private async handleCoordinationRequest(taskId: string, agentId: string, payload: any): Promise<void> {
    // Handle inter-agent coordination requests
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Route coordination request to other assigned agents
    const otherAgents = task.assignedAgents.filter(id => id !== agentId);

    if (otherAgents.length > 0) {
      const message = {
        id: `coordination_response_${taskId}_${Date.now()}`,
        senderId: 'swarm-coordinator',
        recipientId: '',
        payload: {
          type: 'coordination_response',
          originalRequest: payload,
          taskId,
          fromAgent: agentId
        },
        timestamp: new Date(),
        ttl: 30000 // 30 seconds TTL
      };

      await this.communication.broadcastMessage(message, otherAgents);
    }

    this.emit('coordinationRequestHandled', { taskId, agentId, request: payload });
  }

  /**
   * Broadcast task start signal
   */
  private async broadcastTaskStart(task: SwarmTask): Promise<void> {
    const message = {
      id: `task_start_${task.id}`,
      senderId: 'swarm-coordinator',
      recipientId: '',
      payload: {
        type: 'task_start',
        task
      },
      timestamp: new Date(),
      ttl: 60000 // 1 minute TTL
    };

    await this.communication.broadcastMessage(message, task.assignedAgents);
  }

  /**
   * Handle task completion
   */
  private async handleTaskCompletion(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';

    // Free up assigned agents
    for (const agentId of task.assignedAgents) {
      const agent = this.agentStates.get(agentId);
      if (agent) {
        agent.currentLoad = Math.max(0, agent.currentLoad - 1);
        if (agent.currentLoad === 0) {
          agent.status = 'idle';
        }
      }
    }

    // Broadcast completion
    const message = {
      id: `task_completed_${taskId}`,
      senderId: 'swarm-coordinator',
      recipientId: '',
      payload: {
        type: 'task_completed',
        taskId,
        completedAt: new Date()
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL
    };

    await this.communication.broadcastMessage(message, task.assignedAgents);

    this.emit('taskCompleted', { taskId, task });
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';

    // Free up assigned agents
    for (const agentId of task.assignedAgents) {
      const agent = this.agentStates.get(agentId);
      if (agent) {
        agent.currentLoad = Math.max(0, agent.currentLoad - 1);
        if (agent.currentLoad === 0) {
          agent.status = 'idle';
        }
      }
    }

    // Attempt to reassign task to other agents
    await this.attemptTaskReassignment(task);

    this.emit('taskFailed', { taskId, task });
  }

  /**
   * Attempt to reassign failed task
   */
  private async attemptTaskReassignment(task: SwarmTask): Promise<void> {
    task.assignedAgents = [];
    task.status = 'pending';
    task.progress = 0;

    // Broadcast task offer again
    await this.broadcastTaskOffer(task);

    this.emit('taskReassigned', { taskId: task.id });
  }

  /**
   * Perform periodic coordination cycle
   */
  private async performCoordinationCycle(): Promise<void> {
    // Check for tasks that need reassignment
    const pendingTasks = this.getTasksByStatus('pending');
    for (const task of pendingTasks) {
      const timeSinceCreation = Date.now() - task.createdAt.getTime();
      if (timeSinceCreation > 30000 && task.assignedAgents.length === 0) { // 30 seconds
        // Re-broadcast task offer
        await this.broadcastTaskOffer(task);
      }
    }

    // Check for stuck tasks
    const inProgressTasks = this.getTasksByStatus('in_progress');
    for (const task of inProgressTasks) {
      const lastProgressUpdate = Math.max(
        ...this.coordinationHistory
          .filter(msg => msg.taskId === task.id && msg.type === 'progress_update')
          .map(msg => msg.timestamp.getTime())
      );

      if (Date.now() - lastProgressUpdate > this.stuckTaskThreshold) {
        // Mark task as potentially stuck
        this.emit('taskStuck', { taskId: task.id, lastUpdate: new Date(lastProgressUpdate) });
      }
    }

    // Update agent states
    this.updateAgentStates();

    this.emit('coordinationCycleCompleted');
  }

  /**
   * Get available agents for a task
   */
  private getAvailableAgentsForTask(task: SwarmTask): Agent[] {
    return Array.from(this.agentStates.values()).filter(agent => {
      // Check if agent is available
      if (agent.status !== 'idle') return false;

      // Check capability requirements
      for (const requirement of task.requirements) {
        if (!agent.capabilities.includes(requirement.capability)) {
          return false;
        }
      }

      // Check reputation threshold (simplified)
      if (agent.reputation < 0.5) return false;

      return true;
    });
  }

  /**
   * Initialize agent states from registry
   */
  private initializeAgentStates(): void {
    const allAgents = this.registry.getAllAgents();

    for (const agent of allAgents) {
      const agentState: Agent = {
        id: agent.id,
        capabilities: agent.capabilities.map(cap => cap.id),
        currentLoad: 0,
        reputation: agent.metadata.reputation,
        lastActive: agent.lastHeartbeat,
        status: agent.status === 'active' ? 'idle' : 'offline'
      };

      this.agentStates.set(agent.id, agentState);
    }
  }

  /**
   * Update agent states
   */
  private updateAgentStates(): void {
    const allAgents = this.registry.getAllAgents();

    for (const agent of allAgents) {
      const existingState = this.agentStates.get(agent.id);

      if (existingState) {
        existingState.reputation = agent.metadata.reputation;
        existingState.lastActive = agent.lastHeartbeat;
        existingState.status = agent.status === 'active'
          ? (existingState.currentLoad > 0 ? 'busy' : 'idle')
          : 'offline';
      } else {
        // New agent
        const agentState: Agent = {
          id: agent.id,
          capabilities: agent.capabilities.map(cap => cap.id),
          currentLoad: 0,
          reputation: agent.metadata.reputation,
          lastActive: agent.lastHeartbeat,
          status: agent.status === 'active' ? 'idle' : 'offline'
        };

        this.agentStates.set(agent.id, agentState);
      }
    }
  }

  /**
   * Get message priority for coordination
   */
  private getMessagePriority(type: string): number {
    switch (type) {
      case 'task_acceptance': return 9;
      case 'task_rejection': return 7;
      case 'progress_update': return 8;
      case 'coordination_request': return 6;
      case 'task_offer': return 5;
      default: return 1;
    }
  }

  /**
   * Clean shutdown
   */
  destroy(): void {
    if (this.coordinationIntervalHandle) {
      clearInterval(this.coordinationIntervalHandle);
      this.coordinationIntervalHandle = null;
    }
    if (this.onMessageHandler) {
      this.communication.off('messageReceived', this.onMessageHandler);
      this.onMessageHandler = null;
    }
    this.removeAllListeners();
  }
}