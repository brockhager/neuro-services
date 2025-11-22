export interface SwarmTask {
    id: string;
    description: string;
    requirements: TaskRequirement[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    deadline?: Date;
    dependencies: string[];
    estimatedDuration: number; // milliseconds
    maxConcurrentAgents: number;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
    createdAt: Date;
    assignedAgents: string[];
    progress: number; // 0-100
}

export interface TaskRequirement {
    capability: string;
    minPerformance: number;
    quantity: number;
}

export interface Agent {
    id: string;
    capabilities: string[];
    currentLoad: number;
    reputation: number;
    lastActive: Date;
    status: 'idle' | 'busy' | 'offline';
}

export interface TaskAllocation {
    taskId: string;
    agentId: string;
    role: 'primary' | 'secondary' | 'coordinator';
    assignedAt: Date;
    expectedCompletion: Date;
}

export interface CoordinationMessage {
    type: 'task_offer' | 'task_acceptance' | 'task_rejection' | 'progress_update' | 'coordination_request';
    taskId: string;
    agentId: string;
    payload: any;
    timestamp: Date;
    priority: number;
}

export interface SwarmMetrics {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
    agentUtilization: number;
    coordinationEfficiency: number;
    lastUpdate: Date;
}
