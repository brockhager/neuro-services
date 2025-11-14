import { EventEmitter } from 'events';
import { SecureCommunicationFramework } from '../communication';
import { AgentRegistry } from '../agent-registry/index';

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  targetAgent: string;
  validationType: 'output' | 'decision' | 'contribution';
  evidence: Evidence[];
  stakeRequirement: number;
  deadline: Date;
  timestamp: Date;
}

export interface ConsensusVote {
  proposalId: string;
  voterId: string;
  vote: 'approve' | 'reject' | 'abstain';
  stake: number;
  reasoning?: string;
  signature?: Buffer;
  timestamp: Date;
}

export interface ConsensusResult {
  proposalId: string;
  outcome: 'approved' | 'rejected' | 'quorum_not_met';
  totalVotes: number;
  approveVotes: number;
  rejectVotes: number;
  abstainVotes: number;
  totalStake: number;
  approveStake: number;
  rejectStake: number;
  timestamp: Date;
  quorumReached: boolean;
  thresholdMet: boolean;
}

export interface Evidence {
  type: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface ConsensusConfig {
  quorumThreshold: number; // Minimum participation percentage (0-1)
  approvalThreshold: number; // Minimum approval percentage (0-1)
  votingPeriodHours: number;
  minStakeRequirement: number;
  maxProposalLifetime: number;
}

/**
 * Decentralized Consensus Engine for AI Agent Validation
 * Integrates with Secure Communication Framework for real-time quorum validation
 */
export class ConsensusEngine extends EventEmitter {
  private proposals: Map<string, ConsensusProposal> = new Map();
  private votes: Map<string, ConsensusVote[]> = new Map();
  private results: Map<string, ConsensusResult> = new Map();
  private activeProposals: Set<string> = new Set();

  constructor(
    private communication: SecureCommunicationFramework,
    private registry: AgentRegistry,
    private config: ConsensusConfig = {
      quorumThreshold: 0.2, // 20% participation
      approvalThreshold: 0.5, // 50% approval
      votingPeriodHours: 24,
      minStakeRequirement: 100,
      maxProposalLifetime: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  ) {
    super();

    // Listen for consensus messages from communication framework
    this.communication.on('messageReceived', (message) => {
      this.handleConsensusMessage(message);
    });

    // Start periodic cleanup of expired proposals
    setInterval(() => this.cleanupExpiredProposals(), 60 * 60 * 1000); // Hourly cleanup
  }

  /**
   * Propose a validation for consensus
   */
  async proposeValidation(proposal: Omit<ConsensusProposal, 'id' | 'timestamp'>): Promise<string> {
    const proposalId = `consensus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullProposal: ConsensusProposal = {
      ...proposal,
      id: proposalId,
      timestamp: new Date()
    };

    // Validate proposal requirements
    if (proposal.stakeRequirement < this.config.minStakeRequirement) {
      throw new Error(`Stake requirement too low: ${proposal.stakeRequirement} < ${this.config.minStakeRequirement}`);
    }

    // Store proposal
    this.proposals.set(proposalId, fullProposal);
    this.votes.set(proposalId, []);
    this.activeProposals.add(proposalId);

    // Broadcast proposal to all registered agents
    await this.broadcastProposal(fullProposal);

    this.emit('proposalCreated', fullProposal);
    return proposalId;
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(vote: Omit<ConsensusVote, 'timestamp'>): Promise<void> {
    const proposal = this.proposals.get(vote.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${vote.proposalId} not found`);
    }

    // Check if voting period is still open
    const votingDeadline = new Date(proposal.timestamp.getTime() + (this.config.votingPeriodHours * 60 * 60 * 1000));
    if (new Date() > votingDeadline) {
      throw new Error(`Voting period expired for proposal ${vote.proposalId}`);
    }

    // Validate voter has minimum stake
    if (vote.stake < this.config.minStakeRequirement) {
      throw new Error(`Insufficient stake for voting: ${vote.stake}`);
    }

    // Check for duplicate votes
    const existingVotes = this.votes.get(vote.proposalId) || [];
    const duplicateVote = existingVotes.find(v => v.voterId === vote.voterId);
    if (duplicateVote) {
      throw new Error(`Voter ${vote.voterId} has already voted on proposal ${vote.proposalId}`);
    }

    const fullVote: ConsensusVote = {
      ...vote,
      timestamp: new Date()
    };

    // Store vote
    existingVotes.push(fullVote);
    this.votes.set(vote.proposalId, existingVotes);

    // Broadcast vote to all agents for real-time quorum tracking
    await this.broadcastVote(fullVote);

    this.emit('voteCast', fullVote);

    // Check if consensus can be reached
    await this.checkConsensus(vote.proposalId);
  }

  /**
   * Get consensus outcome for a proposal
   */
  async getConsensusOutcome(proposalId: string): Promise<ConsensusResult | null> {
    return this.results.get(proposalId) || null;
  }

  /**
   * Get all active proposals
   */
  getActiveProposals(): ConsensusProposal[] {
    return Array.from(this.activeProposals).map(id => this.proposals.get(id)!);
  }

  /**
   * Get voting statistics for a proposal
   */
  getVotingStats(proposalId: string): {
    totalVotes: number;
    approveVotes: number;
    rejectVotes: number;
    abstainVotes: number;
    totalStake: number;
    approveStake: number;
    rejectStake: number;
    quorumPercentage: number;
    approvalPercentage: number;
  } | null {
    const proposal = this.proposals.get(proposalId);
    const votes = this.votes.get(proposalId) || [];

    if (!proposal) return null;

    const stats = votes.reduce((acc, vote) => {
      acc.totalVotes++;
      acc.totalStake += vote.stake;

      switch (vote.vote) {
        case 'approve':
          acc.approveVotes++;
          acc.approveStake += vote.stake;
          break;
        case 'reject':
          acc.rejectVotes++;
          acc.rejectStake += vote.stake;
          break;
        case 'abstain':
          acc.abstainVotes++;
          break;
      }
      return acc;
    }, {
      totalVotes: 0,
      approveVotes: 0,
      rejectVotes: 0,
      abstainVotes: 0,
      totalStake: 0,
      approveStake: 0,
      rejectStake: 0
    });

    // Calculate participation quorum
    const totalAgents = this.registry.getAllAgents().length;
    const quorumPercentage = totalAgents > 0 ? stats.totalVotes / totalAgents : 0;
    const approvalPercentage = stats.totalVotes > 0 ? stats.approveVotes / stats.totalVotes : 0;

    return {
      ...stats,
      quorumPercentage,
      approvalPercentage
    };
  }

  /**
   * Broadcast proposal to all registered agents
   */
  private async broadcastProposal(proposal: ConsensusProposal): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `proposal_broadcast_${proposal.id}`,
      senderId: 'consensus-engine',
      recipientId: '', // Will be set per recipient
      payload: {
        type: 'consensus_proposal',
        proposal
      },
      timestamp: new Date(),
      ttl: this.config.votingPeriodHours * 60 * 60 * 1000 // Voting period TTL
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Broadcast vote to all registered agents
   */
  private async broadcastVote(vote: ConsensusVote): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `vote_broadcast_${vote.proposalId}_${vote.voterId}`,
      senderId: vote.voterId,
      recipientId: '', // Will be set per recipient
      payload: {
        type: 'consensus_vote',
        vote
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL for real-time updates
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Handle incoming consensus messages
   */
  private async handleConsensusMessage(message: any): Promise<void> {
    try {
      const { type, proposal, vote } = message.payload;

      switch (type) {
        case 'consensus_proposal':
          // Store remote proposal for quorum tracking
          if (!this.proposals.has(proposal.id)) {
            this.proposals.set(proposal.id, proposal);
            this.votes.set(proposal.id, []);
            this.activeProposals.add(proposal.id);
            this.emit('remoteProposalReceived', proposal);
          }
          break;

        case 'consensus_vote':
          // Store remote vote for quorum tracking
          const existingVotes = this.votes.get(vote.proposalId) || [];
          const duplicateVote = existingVotes.find(v => v.voterId === vote.voterId);
          if (!duplicateVote) {
            existingVotes.push(vote);
            this.votes.set(vote.proposalId, existingVotes);
            this.emit('remoteVoteReceived', vote);

            // Check consensus on remote vote
            await this.checkConsensus(vote.proposalId);
          }
          break;
      }
    } catch (error) {
      this.emit('consensusMessageError', { message, error });
    }
  }

  /**
   * Check if consensus has been reached for a proposal
   */
  private async checkConsensus(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    const votes = this.votes.get(proposalId) || [];

    if (!proposal) return;

    const stats = this.getVotingStats(proposalId);
    if (!stats) return;

    // Check if voting period has expired
    const votingDeadline = new Date(proposal.timestamp.getTime() + (this.config.votingPeriodHours * 60 * 60 * 1000));
    const expired = new Date() > votingDeadline;

    // Check quorum and approval thresholds
    const quorumReached = stats.quorumPercentage >= this.config.quorumThreshold;
    const thresholdMet = stats.approvalPercentage >= this.config.approvalThreshold;

    // Determine outcome
    let outcome: ConsensusResult['outcome'];
    if (quorumReached && thresholdMet) {
      outcome = 'approved';
    } else if (expired && !quorumReached) {
      outcome = 'quorum_not_met';
    } else if (expired) {
      outcome = 'rejected';
    } else {
      return; // Still voting
    }

    const result: ConsensusResult = {
      proposalId,
      outcome,
      totalVotes: stats.totalVotes,
      approveVotes: stats.approveVotes,
      rejectVotes: stats.rejectVotes,
      abstainVotes: stats.abstainVotes,
      totalStake: stats.totalStake,
      approveStake: stats.approveStake,
      rejectStake: stats.rejectStake,
      timestamp: new Date(),
      quorumReached,
      thresholdMet
    };

    // Store result
    this.results.set(proposalId, result);
    this.activeProposals.delete(proposalId);

    // Broadcast final result
    await this.broadcastConsensusResult(result);

    this.emit('consensusReached', result);
  }

  /**
   * Broadcast consensus result to all agents
   */
  private async broadcastConsensusResult(result: ConsensusResult): Promise<void> {
    const allAgents = this.registry.getAllAgents();
    const recipientIds = allAgents.map(agent => agent.id);

    const message = {
      id: `consensus_result_${result.proposalId}`,
      senderId: 'consensus-engine',
      recipientId: '',
      payload: {
        type: 'consensus_result',
        result
      },
      timestamp: new Date(),
      ttl: 300000 // 5 minutes TTL
    };

    await this.communication.broadcastMessage(message, recipientIds);
  }

  /**
   * Clean up expired proposals
   */
  private cleanupExpiredProposals(): void {
    const now = Date.now();
    const maxLifetime = this.config.maxProposalLifetime;

    for (const [proposalId, proposal] of this.proposals) {
      if (now - proposal.timestamp.getTime() > maxLifetime) {
        this.proposals.delete(proposalId);
        this.votes.delete(proposalId);
        this.results.delete(proposalId);
        this.activeProposals.delete(proposalId);
        this.emit('proposalExpired', proposalId);
      }
    }
  }

  /**
   * Get consensus engine metrics
   */
  getMetrics(): {
    activeProposals: number;
    totalProposals: number;
    totalVotes: number;
    resolvedProposals: number;
    averageQuorumTime: number;
  } {
    const totalVotes = Array.from(this.votes.values()).reduce((sum, votes) => sum + votes.length, 0);
    const resolvedProposals = this.results.size;

    // Calculate average quorum time for resolved proposals
    let totalQuorumTime = 0;
    let resolvedCount = 0;

    for (const [proposalId, result] of this.results) {
      const proposal = this.proposals.get(proposalId);
      if (proposal) {
        totalQuorumTime += result.timestamp.getTime() - proposal.timestamp.getTime();
        resolvedCount++;
      }
    }

    const averageQuorumTime = resolvedCount > 0 ? totalQuorumTime / resolvedCount : 0;

    return {
      activeProposals: this.activeProposals.size,
      totalProposals: this.proposals.size,
      totalVotes,
      resolvedProposals,
      averageQuorumTime
    };
  }
}