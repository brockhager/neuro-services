import { EventEmitter } from 'events';
import { SecureCommunicationFramework, SecureMessage } from '../communication';
import { AgentRegistry } from '../agent-registry/index';

export interface FundingProposal {
  id: string;
  proposerId: string;
  projectId: string;
  title: string;
  description: string;
  requestedAmount: number;
  category: ContributionType;
  evidence: Evidence[];
  timestamp: Date;
  deadline: Date;
}

export interface Contribution {
  contributorId: string;
  proposalId: string;
  amount: number;
  timestamp: Date;
  signature?: Buffer;
}

export interface QuadraticFundingResult {
  proposalId: string;
  totalContributions: number;
  contributorCount: number;
  matchingAmount: number;
  finalFunding: number;
  contributors: Contribution[];
}

export interface EconomicParameters {
  totalPool: number;
  matchingMultiplier: number; // How much matching funds to add
  timeDecayFactor: number; // Recent contributions weighted more
  reputationBonus: number; // Reputation-based contribution bonus
}

export interface Evidence {
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  source: string;
}

export type ContributionType = 'development' | 'research' | 'infrastructure' | 'education' | 'community';

/**
 * Tokenomics Engine with Quadratic Funding Integration
 * Uses secure broadcast messaging for funding proposal distribution
 */
export class TokenomicsEngine extends EventEmitter {
  private proposals: Map<string, FundingProposal> = new Map();
  private contributions: Map<string, Contribution[]> = new Map();
  private fundingResults: Map<string, QuadraticFundingResult> = new Map();
  private activeProposals: Set<string> = new Set();

  constructor(
    private communication: SecureCommunicationFramework,
    private registry: AgentRegistry,
    private economicParams: EconomicParameters = {
      totalPool: 100000, // Total matching pool
      matchingMultiplier: 0.5, // 50% matching
      timeDecayFactor: 0.1, // 10% time decay
      reputationBonus: 0.2 // 20% reputation bonus
    }
  ) {
    super();

    // Listen for funding messages from communication framework
    this.onMessageHandler = (message: SecureMessage) => this.handleFundingMessage(message);
    this.communication.on('messageReceived', this.onMessageHandler);
  }

  private onMessageHandler: ((message: SecureMessage) => void) | null = null;

  /**
   * Submit a funding proposal
   */
  async submitFundingProposal(proposal: Omit<FundingProposal, 'id' | 'timestamp'>): Promise<string> {
    const proposalId = `funding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullProposal: FundingProposal = {
      ...proposal,
      id: proposalId,
      timestamp: new Date()
    };

    // Validate proposal
    if (proposal.requestedAmount <= 0) {
      throw new Error('Requested amount must be positive');
    }

    // Enhanced deadline validation with edge cases
    const now = new Date();
    if (proposal.deadline <= now) {
      await this.logGovernanceEvent('deadline_validation', {
        event: 'proposal_deadline_past',
        proposalId,
        deadline: proposal.deadline,
        currentTime: now,
        details: 'Proposal deadline must be in the future'
      });
      throw new Error('Proposal deadline must be in the future');
    }

    // Check for overlapping deadlines (within 1 hour)
    const overlappingProposals = Array.from(this.proposals.values()).filter(p =>
      Math.abs(p.deadline.getTime() - proposal.deadline.getTime()) < 3600000 && // 1 hour
      p.proposerId === proposal.proposerId
    );

    if (overlappingProposals.length > 0) {
      await this.logGovernanceEvent('deadline_validation', {
        event: 'overlapping_deadlines',
        proposalId,
        overlappingProposalIds: overlappingProposals.map(p => p.id),
        deadline: proposal.deadline,
        details: 'Proposer has overlapping proposal deadlines'
      });
      // Allow but log warning
      this.emit('overlappingDeadlines', { newProposal: fullProposal, overlapping: overlappingProposals });
    }

    // Store proposal
    this.proposals.set(proposalId, fullProposal);
    this.contributions.set(proposalId, []);
    this.activeProposals.add(proposalId);

    // Broadcast proposal to all registered agents
    await this.broadcastFundingProposal(fullProposal);

    await this.logGovernanceEvent('proposal_submitted', {
      proposalId,
      proposerId: proposal.proposerId,
      deadline: proposal.deadline,
      requestedAmount: proposal.requestedAmount
    });

    this.emit('proposalSubmitted', fullProposal);
    return proposalId;
  }

  /**
   * Contribute to a funding proposal
   */
  async contributeToProposal(contribution: Omit<Contribution, 'timestamp'>): Promise<void> {
    const proposal = this.proposals.get(contribution.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${contribution.proposalId} not found`);
    }

    const now = new Date();
    // Enhanced deadline validation for contributions
    if (now > proposal.deadline) {
      await this.logGovernanceEvent('deadline_validation', {
        event: 'late_contribution_attempt',
        proposalId: contribution.proposalId,
        contributorId: contribution.contributorId,
        deadline: proposal.deadline,
        attemptTime: now,
        details: 'Contribution attempted after deadline'
      });
      throw new Error(`Contribution period expired for proposal ${contribution.proposalId}`);
    }

    // Boundary case: allow contributions exactly at deadline (within 1 second)
    if (Math.abs(now.getTime() - proposal.deadline.getTime()) <= 1000) {
      await this.logGovernanceEvent('deadline_validation', {
        event: 'boundary_contribution',
        proposalId: contribution.proposalId,
        contributorId: contribution.contributorId,
        deadline: proposal.deadline,
        contributionTime: now,
        details: 'Contribution at deadline boundary'
      });
    }

    // Validate contribution amount
    if (contribution.amount <= 0) {
      throw new Error('Contribution amount must be positive');
    }

    const fullContribution: Contribution = {
      ...contribution,
      timestamp: new Date()
    };

    // Store contribution
    const existingContributions = this.contributions.get(contribution.proposalId) || [];
    existingContributions.push(fullContribution);
    this.contributions.set(contribution.proposalId, existingContributions);

    // Broadcast contribution for transparency
    await this.broadcastContribution(fullContribution);

    this.emit('contributionReceived', fullContribution);

    // Log incentive flow with authenticated signature
    await this.logIncentiveFlow(fullContribution);
  }

  /**
   * Calculate quadratic funding results for a proposal
   */
  async calculateQuadraticFunding(proposalId: string): Promise<QuadraticFundingResult> {
    const proposal = this.proposals.get(proposalId);
    const contributions = this.contributions.get(proposalId) || [];

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Calculate total contributions with time decay and reputation bonuses
    let totalContributions = 0;
    const now = Date.now();

    for (const contribution of contributions) {
      let adjustedAmount = contribution.amount;

      // Apply time decay (recent contributions weighted more)
      const ageHours = (now - contribution.timestamp.getTime()) / (1000 * 60 * 60);
      const timeMultiplier = Math.exp(-this.economicParams.timeDecayFactor * ageHours);
      adjustedAmount *= timeMultiplier;

      // Apply reputation bonus
      const contributorAgent = this.registry.getAgent(contribution.contributorId);
      if (contributorAgent) {
        const reputationMultiplier = 1 + (this.economicParams.reputationBonus * contributorAgent.metadata.reputation);
        adjustedAmount *= reputationMultiplier;
      }

      totalContributions += adjustedAmount;
    }

    // Calculate quadratic matching
    const matchingAmount = Math.sqrt(totalContributions) * this.economicParams.matchingMultiplier;
    const finalFunding = Math.min(
      totalContributions + matchingAmount,
      this.economicParams.totalPool // Cap at available pool
    );

    const result: QuadraticFundingResult = {
      proposalId,
      totalContributions,
      contributorCount: contributions.length,
      matchingAmount,
      finalFunding,
      contributors: contributions
    };

    // Store result
    this.fundingResults.set(proposalId, result);
    this.activeProposals.delete(proposalId);

    // Broadcast final results
    await this.broadcastFundingResult(result);

    this.emit('fundingCalculated', result);
    return result;
  }

  /**
   * Get funding proposal details
   */
  getFundingProposal(proposalId: string): FundingProposal | null {
    return this.proposals.get(proposalId) || null;
  }

  /**
   * Get contributions for a proposal
   */
  getContributions(proposalId: string): Contribution[] {
    return this.contributions.get(proposalId) || [];
  }

  /**
   * Get funding result for a proposal
   */
  getFundingResult(proposalId: string): QuadraticFundingResult | null {
    return this.fundingResults.get(proposalId) || null;
  }

  /**
   * Get all active funding proposals
   */
  getActiveProposals(): FundingProposal[] {
    return Array.from(this.activeProposals).map(id => this.proposals.get(id)!);
  }

  /**
   * Broadcast funding proposal to all agents
   */
  private async broadcastFundingProposal(proposal: FundingProposal): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `funding_proposal_${proposal.id}`,
      senderId: 'tokenomics-engine',
      recipientId: '',
      payload: {
        type: 'funding_proposal',
        proposal
      },
      timestamp: new Date(),
      ttl: (proposal.deadline.getTime() - Date.now()) // TTL until deadline
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Broadcast contribution for transparency
   */
  private async broadcastContribution(contribution: Contribution): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `funding_contribution_${contribution.proposalId}_${contribution.contributorId}`,
      senderId: contribution.contributorId,
      recipientId: '',
      payload: {
        type: 'funding_contribution',
        contribution
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL for real-time updates
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Broadcast final funding results
   */
  private async broadcastFundingResult(result: QuadraticFundingResult): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `funding_result_${result.proposalId}`,
      senderId: 'tokenomics-engine',
      recipientId: '',
      payload: {
        type: 'funding_result',
        result
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Log incentive flow with authenticated signature
   */
  private async logIncentiveFlow(contribution: Contribution): Promise<void> {
    const proposal = this.proposals.get(contribution.proposalId);
    if (!proposal) return;

    // Create signed log entry
    const logEntry = {
      type: 'incentive_flow',
      contribution,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        category: proposal.category
      },
      timestamp: new Date(),
      authenticated: true
    };

    // Sign the log entry (simplified - in production would use proper crypto)
    // In a real implementation, this would be signed and stored in a blockchain

    // Emit for governance dashboard logging
    this.emit('incentiveFlowLogged', {
      ...logEntry,
      signature: Buffer.from('mock_signature') // Placeholder
    });
  }

  /**
   * Log governance events for deadline validation and other important events
   */
  private async logGovernanceEvent(eventType: string, eventData: Record<string, unknown>): Promise<void> {
    const governanceLog = {
      eventType,
      timestamp: new Date(),
      ...eventData
    };

    // Emit for governance dashboard and logging systems
    this.emit('governanceEvent', governanceLog);

    // In production, this would be written to a secure log file or blockchain
    console.log('Governance Event:', JSON.stringify(governanceLog, null, 2));
  }

  /**
   * Handle incoming funding messages
   */
  private async handleFundingMessage(message: SecureMessage): Promise<void> {
    try {
      const { type, proposal, contribution, result } = message.payload;

      switch (type) {
        case 'funding_proposal': {
          // Store remote proposal
          if (!this.proposals.has(proposal.id)) {
            this.proposals.set(proposal.id, proposal);
            this.contributions.set(proposal.id, []);
            this.activeProposals.add(proposal.id);
            this.emit('remoteProposalReceived', proposal);
          }
          break;
        }

        case 'funding_contribution': {
          // Store remote contribution
          const existingContributions = this.contributions.get(contribution.proposalId) || [];
          const duplicateContribution = existingContributions.find(
            c => c.contributorId === contribution.contributorId && c.timestamp.getTime() === contribution.timestamp.getTime()
          );
          if (!duplicateContribution) {
            existingContributions.push(contribution);
            this.contributions.set(contribution.proposalId, existingContributions);
            this.emit('remoteContributionReceived', contribution);
          }
          break;
        }

        case 'funding_result': {
          // Store remote result
          this.fundingResults.set(result.proposalId, result);
          this.emit('remoteFundingResultReceived', result);
          break;
        }
      }
    } catch (error) {
      this.emit('fundingMessageError', { message, error });
    }
  }

  /**
   * Get tokenomics engine metrics
   */
  getMetrics(): {
    activeProposals: number;
    totalProposals: number;
    totalContributions: number;
    totalFundingDistributed: number;
    averageMatchingRatio: number;
  } {
    const totalContributions = Array.from(this.contributions.values())
      .reduce((sum, contributions) => sum + contributions.reduce((s, c) => s + c.amount, 0), 0);

    const totalFundingDistributed = Array.from(this.fundingResults.values())
      .reduce((sum, result) => sum + result.finalFunding, 0);

    const totalMatchingAmount = Array.from(this.fundingResults.values())
      .reduce((sum, result) => sum + result.matchingAmount, 0);

    const averageMatchingRatio = this.fundingResults.size > 0
      ? totalMatchingAmount / this.fundingResults.size
      : 0;

    return {
      activeProposals: this.activeProposals.size,
      totalProposals: this.proposals.size,
      totalContributions,
      totalFundingDistributed,
      averageMatchingRatio
    };
  }

  /**
   * Generate transparency report
   */
  generateTransparencyReport(): {
    totalPool: number;
    remainingPool: number;
    fundedProposals: number;
    totalContributions: number;
    averageContribution: number;
    categoryBreakdown: Record<ContributionType, number>;
  } {
    const fundedResults = Array.from(this.fundingResults.values());
    const totalContributions = fundedResults.reduce((sum, result) =>
      sum + result.contributors.reduce((s, c) => s + c.amount, 0), 0
    );

    const categoryBreakdown = fundedResults.reduce((acc, result) => {
      const proposal = this.proposals.get(result.proposalId);
      if (proposal) {
        acc[proposal.category] = (acc[proposal.category] || 0) + result.finalFunding;
      }
      return acc;
    }, {} as Record<ContributionType, number>);

    return {
      totalPool: this.economicParams.totalPool,
      remainingPool: this.economicParams.totalPool - fundedResults.reduce((sum, r) => sum + r.finalFunding, 0),
      fundedProposals: fundedResults.length,
      totalContributions,
      averageContribution: fundedResults.length > 0 ? totalContributions / fundedResults.length : 0,
      categoryBreakdown
    };
  }

  destroy(): void {
    if (this.onMessageHandler) {
      this.communication.off('messageReceived', this.onMessageHandler);
      this.onMessageHandler = null;
    }
    this.proposals.clear();
    this.contributions.clear();
    this.fundingResults.clear();
    this.activeProposals.clear();
    this.removeAllListeners();
  }
}