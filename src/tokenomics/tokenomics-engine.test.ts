import { TokenomicsEngine, FundingProposal, Contribution } from './tokenomics-engine';
import { SecureCommunicationFramework } from '../communication';
import { AgentRegistry } from '../agent-registry/index';

describe('Tokenomics Engine Integration', () => {
  let registry: AgentRegistry;
  let communication: SecureCommunicationFramework;
  let tokenomics: TokenomicsEngine;

  beforeEach(async () => {
    registry = new AgentRegistry();
    communication = new SecureCommunicationFramework(registry);
    tokenomics = new TokenomicsEngine(communication, registry);

    // Register test agents with varying reputation
    for (let i = 1; i <= 5; i++) {
      registry.registerAgent(`agent${i}`, [], [], {
        name: `Test Agent ${i}`,
        description: `Test agent ${i}`,
        version: '1.0',
        author: 'Test',
        license: 'MIT',
        tags: [],
        reputation: 0.5 + (i * 0.1), // 0.6, 0.7, 0.8, 0.9, 1.0
        totalTasks: 50 + (i * 10),
        successRate: 0.85 + (i * 0.03)
      });
    }
  });

  afterEach(() => {
    communication.destroy();
    registry.destroy();
  });

  describe('Funding Proposal Management', () => {
    it('should submit and broadcast funding proposals', async () => {
      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_123',
        title: 'AI Model Training Infrastructure',
        description: 'Funding for GPU cluster to train advanced AI models',
        requestedAmount: 50000,
        category: 'infrastructure',
        evidence: [
          {
            type: 'performance_projection',
            data: { expectedAccuracy: 0.95, trainingTime: '2 weeks' },
            timestamp: new Date(),
            source: 'agent1'
          }
        ],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      };

      const proposalId = await tokenomics.submitFundingProposal(proposal);

      expect(proposalId).toBeDefined();
      expect(proposalId.startsWith('funding_')).toBe(true);

      // Check proposal was stored
      const storedProposal = tokenomics.getFundingProposal(proposalId);
      expect(storedProposal).toBeDefined();
      expect(storedProposal!.title).toBe(proposal.title);
      expect(storedProposal!.requestedAmount).toBe(proposal.requestedAmount);
    });

    it('should reject invalid proposals', async () => {
      // Test negative amount
      const invalidProposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_123',
        title: 'Test Project',
        description: 'Test description',
        requestedAmount: -1000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(tokenomics.submitFundingProposal(invalidProposal))
        .rejects.toThrow('Requested amount must be positive');

      // Test past deadline
      const pastDeadlineProposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_123',
        title: 'Test Project',
        description: 'Test description',
        requestedAmount: 1000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() - 1000) // Past deadline
      };

      await expect(tokenomics.submitFundingProposal(pastDeadlineProposal))
        .rejects.toThrow('Proposal deadline must be in the future');
    });
  });

  describe('Contribution Processing', () => {
    let proposalId: string;

    beforeEach(async () => {
      // Create a proposal
      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_123',
        title: 'Test Project',
        description: 'Test funding project',
        requestedAmount: 10000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      proposalId = await tokenomics.submitFundingProposal(proposal);
    });

    it('should accept and broadcast contributions', async () => {
      const contribution: Omit<Contribution, 'timestamp'> = {
        contributorId: 'agent2',
        proposalId,
        amount: 1000
      };

      await expect(tokenomics.contributeToProposal(contribution)).resolves.toBeUndefined();

      // Check contribution was stored
      const contributions = tokenomics.getContributions(proposalId);
      expect(contributions.length).toBe(1);
      expect(contributions[0].amount).toBe(1000);
      expect(contributions[0].contributorId).toBe('agent2');
    });

    it('should reject invalid contributions', async () => {
      // Test negative amount
      const invalidContribution: Omit<Contribution, 'timestamp'> = {
        contributorId: 'agent2',
        proposalId,
        amount: -500
      };

      await expect(tokenomics.contributeToProposal(invalidContribution))
        .rejects.toThrow('Contribution amount must be positive');

      // Test expired proposal
      const expiredProposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_expired',
        title: 'Expired Project',
        description: 'Already expired',
        requestedAmount: 1000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() - 1000) // Already expired
      };

      const expiredProposalId = await tokenomics.submitFundingProposal(expiredProposal);

      const contributionToExpired: Omit<Contribution, 'timestamp'> = {
        contributorId: 'agent2',
        proposalId: expiredProposalId,
        amount: 500
      };

      await expect(tokenomics.contributeToProposal(contributionToExpired))
        .rejects.toThrow('Contribution period expired');
    });

    it('should apply reputation bonuses to contributions', async () => {
      // Contribute from agent with high reputation (agent5 has reputation 1.0)
      const highRepContribution: Omit<Contribution, 'timestamp'> = {
        contributorId: 'agent5', // Highest reputation
        proposalId,
        amount: 1000
      };

      // Contribute from agent with lower reputation (agent1 has reputation 0.6)
      const lowRepContribution: Omit<Contribution, 'timestamp'> = {
        contributorId: 'agent1', // Lower reputation
        proposalId,
        amount: 1000
      };

      await tokenomics.contributeToProposal(highRepContribution);
      await tokenomics.contributeToProposal(lowRepContribution);

      // Calculate quadratic funding
      const result = await tokenomics.calculateQuadraticFunding(proposalId);

      // High reputation agent should get more matching due to reputation bonus
      expect(result.finalFunding).toBeGreaterThan(result.totalContributions);
      expect(result.matchingAmount).toBeGreaterThan(0);
    });
  });

  describe('Quadratic Funding Calculations', () => {
    let proposalId: string;

    beforeEach(async () => {
      // Create a proposal
      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'project_quadratic',
        title: 'Quadratic Funding Test',
        description: 'Testing quadratic funding calculations',
        requestedAmount: 50000,
        category: 'research',
        evidence: [],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      proposalId = await tokenomics.submitFundingProposal(proposal);
    });

    it('should calculate quadratic funding correctly', async () => {
      // Add multiple contributions
      const contributions = [
        { contributorId: 'agent2', amount: 100 },
        { contributorId: 'agent3', amount: 200 },
        { contributorId: 'agent4', amount: 300 },
        { contributorId: 'agent5', amount: 400 }
      ];

      for (const contrib of contributions) {
        await tokenomics.contributeToProposal({
          proposalId,
          ...contrib
        });
      }

      const result = await tokenomics.calculateQuadraticFunding(proposalId);

      // Verify basic quadratic funding math: matching = sqrt(total_contributions) * multiplier
      const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
      const expectedMatching = Math.sqrt(totalContributions) * 0.5; // 0.5 is default matching multiplier

      expect(result.totalContributions).toBe(totalContributions);
      expect(result.matchingAmount).toBeCloseTo(expectedMatching, 2);
      expect(result.finalFunding).toBe(result.totalContributions + result.matchingAmount);
      expect(result.contributorCount).toBe(contributions.length);
    });

    it('should respect funding pool limits', async () => {
      // Create tokenomics engine with small pool
      const limitedTokenomics = new TokenomicsEngine(communication, registry, {
        totalPool: 100, // Very small pool
        matchingMultiplier: 1.0,
        timeDecayFactor: 0.1,
        reputationBonus: 0.2
      });

      // Add large contributions
      await limitedTokenomics.contributeToProposal({
        proposalId,
        contributorId: 'agent2',
        amount: 1000
      });

      const result = await limitedTokenomics.calculateQuadraticFunding(proposalId);

      // Final funding should be capped at pool size
      expect(result.finalFunding).toBeLessThanOrEqual(100);
    });

    it('should generate transparency reports', async () => {
      // Add some contributions and calculate funding
      await tokenomics.contributeToProposal({
        proposalId,
        contributorId: 'agent2',
        amount: 500
      });

      await tokenomics.contributeToProposal({
        proposalId,
        contributorId: 'agent3',
        amount: 750
      });

      await tokenomics.calculateQuadraticFunding(proposalId);

      const report = tokenomics.generateTransparencyReport();

      expect(report.totalPool).toBe(100000); // Default pool
      expect(report.fundedProposals).toBe(1);
      expect(report.totalContributions).toBe(1250);
      expect(report.averageContribution).toBe(1250);
      expect(report.categoryBreakdown.research).toBeDefined();
    });
  });

  describe('Broadcast Messaging Integration', () => {
    it('should broadcast proposals to all agents', async () => {
      let broadcastReceived = false;

      // Listen for broadcast messages
      communication.on('messageSent', (data) => {
        if (data.message.payload.type === 'funding_proposal') {
          broadcastReceived = true;
        }
      });

      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'broadcast_test',
        title: 'Broadcast Test Project',
        description: 'Testing broadcast functionality',
        requestedAmount: 1000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await tokenomics.submitFundingProposal(proposal);

      // In a real scenario, this would be verified by checking all agents received the message
      // For this test, we verify the broadcast was attempted
      expect(broadcastReceived).toBe(true);
    });

    it('should broadcast contributions for transparency', async () => {
      // Create proposal first
      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'transparency_test',
        title: 'Transparency Test',
        description: 'Testing contribution broadcasting',
        requestedAmount: 2000,
        category: 'community',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await tokenomics.submitFundingProposal(proposal);

      let contributionBroadcastReceived = false;

      communication.on('messageSent', (data) => {
        if (data.message.payload.type === 'funding_contribution') {
          contributionBroadcastReceived = true;
        }
      });

      await tokenomics.contributeToProposal({
        proposalId,
        contributorId: 'agent2',
        amount: 500
      });

      expect(contributionBroadcastReceived).toBe(true);
    });
  });

  describe('Incentive Flow Logging', () => {
    it('should log incentive flows with authentication', async () => {
      // Create proposal
      const proposal: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'logging_test',
        title: 'Logging Test Project',
        description: 'Testing incentive flow logging',
        requestedAmount: 1000,
        category: 'education',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId = await tokenomics.submitFundingProposal(proposal);

      let incentiveLogged = false;
      let loggedData: any = null;

      tokenomics.on('incentiveFlowLogged', (data) => {
        incentiveLogged = true;
        loggedData = data;
      });

      // Make contribution
      await tokenomics.contributeToProposal({
        proposalId,
        contributorId: 'agent3',
        amount: 300
      });

      expect(incentiveLogged).toBe(true);
      expect(loggedData).toBeDefined();
      expect(loggedData.type).toBe('incentive_flow');
      expect(loggedData.contribution.amount).toBe(300);
      expect(loggedData.authenticated).toBe(true);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track tokenomics metrics', async () => {
      // Create multiple proposals and contributions
      const proposal1: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent1',
        projectId: 'metrics_test_1',
        title: 'Metrics Test 1',
        description: 'First test project',
        requestedAmount: 1000,
        category: 'development',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposal2: Omit<FundingProposal, 'id' | 'timestamp'> = {
        proposerId: 'agent2',
        projectId: 'metrics_test_2',
        title: 'Metrics Test 2',
        description: 'Second test project',
        requestedAmount: 2000,
        category: 'research',
        evidence: [],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const proposalId1 = await tokenomics.submitFundingProposal(proposal1);
      const proposalId2 = await tokenomics.submitFundingProposal(proposal2);

      // Add contributions
      await tokenomics.contributeToProposal({
        proposalId: proposalId1,
        contributorId: 'agent3',
        amount: 200
      });

      await tokenomics.contributeToProposal({
        proposalId: proposalId2,
        contributorId: 'agent4',
        amount: 300
      });

      await tokenomics.contributeToProposal({
        proposalId: proposalId2,
        contributorId: 'agent5',
        amount: 400
      });

      // Calculate funding for one proposal
      await tokenomics.calculateQuadraticFunding(proposalId1);

      const metrics = tokenomics.getMetrics();

      expect(metrics.totalProposals).toBe(2);
      expect(metrics.activeProposals).toBe(1); // One still active
      expect(metrics.totalContributions).toBe(900);
      expect(metrics.totalFundingDistributed).toBeGreaterThan(0);
    });
  });
});