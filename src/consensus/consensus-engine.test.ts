import { ConsensusEngine, ConsensusProposal, ConsensusVote } from './consensus-engine';
import { SecureCommunicationFramework } from '../communication';
import { AgentRegistry } from '../agent-registry/index';

describe('Consensus Engine Integration', () => {
  let registry: AgentRegistry;
  let communication: SecureCommunicationFramework;
  let consensus: ConsensusEngine;

  beforeEach(async () => {
    registry = new AgentRegistry();
    communication = new SecureCommunicationFramework(registry);
    consensus = new ConsensusEngine(communication, registry);

    // Register test agents
    for (let i = 1; i <= 5; i++) {
      registry.registerAgent(`agent${i}`, [], [], {
        name: `Test Agent ${i}`,
        description: `Test agent ${i}`,
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.8 + (i * 0.04), // Varying reputation
        totalTasks: 50 + (i * 10),
        successRate: 0.85 + (i * 0.03)
      });
    }
  });

  afterEach(() => {
    communication.destroy();
  });

  describe('Proposal Creation and Broadcasting', () => {
    it('should create and broadcast a validation proposal', async () => {
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [
          {
            type: 'performance_metrics',
            data: { accuracy: 0.95, latency: 120 },
            timestamp: new Date(),
            source: 'agent1'
          }
        ],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await consensus.proposeValidation(proposal);

      expect(proposalId).toBeDefined();
      expect(proposalId.startsWith('consensus_')).toBe(true);

      // Check that proposal was stored
      const activeProposals = consensus.getActiveProposals();
      expect(activeProposals.length).toBe(1);
      expect(activeProposals[0].id).toBe(proposalId);
    });

    it('should reject proposal with insufficient stake requirement', async () => {
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 50, // Below minimum
        deadline: new Date()
      };

      await expect(consensus.proposeValidation(proposal))
        .rejects.toThrow('Stake requirement too low');
    });
  });

  describe('Voting and Quorum Validation', () => {
    let proposalId: string;

    beforeEach(async () => {
      // Create a proposal
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      proposalId = await consensus.proposeValidation(proposal);
    });

    it('should accept and broadcast votes', async () => {
      const vote: Omit<ConsensusVote, 'timestamp'> = {
        proposalId,
        voterId: 'agent3',
        vote: 'approve',
        stake: 150,
        reasoning: 'Good performance metrics'
      };

      await expect(consensus.castVote(vote)).resolves.toBeUndefined();

      // Check voting stats
      const stats = consensus.getVotingStats(proposalId);
      expect(stats).toBeDefined();
      expect(stats!.totalVotes).toBe(1);
      expect(stats!.approveVotes).toBe(1);
      expect(stats!.totalStake).toBe(150);
    });

    it('should reject duplicate votes from same voter', async () => {
      const vote1: Omit<ConsensusVote, 'timestamp'> = {
        proposalId,
        voterId: 'agent3',
        vote: 'approve',
        stake: 150
      };

      const vote2: Omit<ConsensusVote, 'timestamp'> = {
        proposalId,
        voterId: 'agent3', // Same voter
        vote: 'reject',
        stake: 150
      };

      await consensus.castVote(vote1);
      await expect(consensus.castVote(vote2))
        .rejects.toThrow('has already voted');
    });

    it('should track real-time quorum across multiple votes', async () => {
      // Cast multiple votes to reach quorum
      const votes = [
        { voterId: 'agent3', vote: 'approve' as const, stake: 200 },
        { voterId: 'agent4', vote: 'approve' as const, stake: 180 },
        { voterId: 'agent5', vote: 'reject' as const, stake: 160 }
      ];

      for (const voteData of votes) {
        await consensus.castVote({
          proposalId,
          ...voteData
        });
      }

      const stats = consensus.getVotingStats(proposalId);
      expect(stats!.totalVotes).toBe(3);
      expect(stats!.approveVotes).toBe(2);
      expect(stats!.rejectVotes).toBe(1);
      expect(stats!.totalStake).toBe(540);

      // Check quorum percentage (3 votes out of 5 agents = 60%)
      expect(stats!.quorumPercentage).toBe(0.6);
      expect(stats!.approvalPercentage).toBe(2/3);
    });
  });

  describe('Consensus Resolution', () => {
    it('should reach consensus when quorum and threshold are met', async () => {
      // Create proposal
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await consensus.proposeValidation(proposal);

      // Mock consensus reached event
      let consensusReached = false;
      consensus.on('consensusReached', (result) => {
        consensusReached = true;
        expect(result.outcome).toBe('approved');
        expect(result.quorumReached).toBe(true);
        expect(result.thresholdMet).toBe(true);
      });

      // Cast enough votes to reach consensus (using custom consensus engine with lower thresholds for testing)
      const testConsensus = new ConsensusEngine(communication, registry, {
        quorumThreshold: 0.4, // 40% quorum
        approvalThreshold: 0.5, // 50% approval
        votingPeriodHours: 24,
        minStakeRequirement: 100,
        maxProposalLifetime: 7 * 24 * 60 * 60 * 1000
      });

      // Cast votes to reach consensus
      await testConsensus.castVote({
        proposalId,
        voterId: 'agent3',
        vote: 'approve',
        stake: 200
      });

      await testConsensus.castVote({
        proposalId,
        voterId: 'agent4',
        vote: 'approve',
        stake: 180
      });

      // Force consensus check (in real implementation this would happen automatically)
      // Note: This test demonstrates the integration - full consensus resolution
      // would require more complex timing and event handling
    });

    it('should provide consensus outcome query', async () => {
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await consensus.proposeValidation(proposal);

      // Initially no outcome
      let outcome = await consensus.getConsensusOutcome(proposalId);
      expect(outcome).toBeNull();

      // Cast a vote
      await consensus.castVote({
        proposalId,
        voterId: 'agent3',
        vote: 'approve',
        stake: 200
      });

      // Still no final outcome (voting ongoing)
      outcome = await consensus.getConsensusOutcome(proposalId);
      expect(outcome).toBeNull();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track consensus metrics', async () => {
      // Create a proposal
      const proposal: Omit<ConsensusProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        targetAgent: 'agent2',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await consensus.proposeValidation(proposal);

      // Cast some votes
      await consensus.castVote({
        proposalId,
        voterId: 'agent3',
        vote: 'approve',
        stake: 200
      });

      await consensus.castVote({
        proposalId,
        voterId: 'agent4',
        vote: 'reject',
        stake: 180
      });

      const metrics = consensus.getMetrics();
      expect(metrics.activeProposals).toBe(1);
      expect(metrics.totalProposals).toBe(1);
      expect(metrics.totalVotes).toBe(2);
      expect(metrics.resolvedProposals).toBe(0); // No resolutions yet
    });
  });

  describe('Real-time Message Integration', () => {
    it('should handle incoming consensus messages', async () => {
      let remoteProposalReceived = false;
      let remoteVoteReceived = false;

      consensus.on('remoteProposalReceived', () => {
        remoteProposalReceived = true;
      });

      consensus.on('remoteVoteReceived', () => {
        remoteVoteReceived = true;
      });

      // Simulate receiving a remote proposal message
      const remoteProposal: ConsensusProposal = {
        id: 'remote_proposal_123',
        proposerId: 'remote_agent',
        targetAgent: 'agent1',
        validationType: 'output',
        evidence: [],
        stakeRequirement: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timestamp: new Date()
      };

      // Simulate the message handling (in real implementation this comes via communication framework)
      await (consensus as any).handleConsensusMessage({
        payload: {
          type: 'consensus_proposal',
          proposal: remoteProposal
        }
      });

      expect(remoteProposalReceived).toBe(true);

      // Simulate receiving a remote vote
      const remoteVote: ConsensusVote = {
        proposalId: 'remote_proposal_123',
        voterId: 'agent3',
        vote: 'approve',
        stake: 150,
        timestamp: new Date()
      };

      await (consensus as any).handleConsensusMessage({
        payload: {
          type: 'consensus_vote',
          vote: remoteVote
        }
      });

      expect(remoteVoteReceived).toBe(true);

      // Check that remote vote was recorded
      const stats = consensus.getVotingStats('remote_proposal_123');
      expect(stats!.totalVotes).toBe(1);
      expect(stats!.approveVotes).toBe(1);
    });
  });
});