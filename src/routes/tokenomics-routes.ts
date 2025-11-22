import { Router } from 'express';
import { TokenomicsEngine } from '../tokenomics/tokenomics-engine.js';

export function createTokenomicsRoutes(tokenomicsEngine: TokenomicsEngine, authenticate: any): Router {
    const router = Router();

    // Submit a funding proposal
    router.post("/v1/tokenomics/proposals", authenticate, async (req, res) => {
        try {
            const proposal = req.body;
            // Ensure proposerId matches authenticated user
            if (proposal.proposerId !== (req as any).user.username) {
                return res.status(403).json({ error: 'Proposer ID must match authenticated user' });
            }

            const proposalId = await tokenomicsEngine.submitFundingProposal(proposal);
            res.status(201).json({ proposalId });
        } catch (error) {
            console.error('Tokenomics proposal error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit proposal' });
        }
    });

    // Contribute to a proposal
    router.post("/v1/tokenomics/contribute", authenticate, async (req, res) => {
        try {
            const contribution = req.body;
            // Ensure contributorId matches authenticated user
            if (contribution.contributorId !== (req as any).user.username) {
                return res.status(403).json({ error: 'Contributor ID must match authenticated user' });
            }

            await tokenomicsEngine.contributeToProposal(contribution);
            res.json({ status: 'contribution_received' });
        } catch (error) {
            console.error('Tokenomics contribution error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to contribute' });
        }
    });

    // Get specific proposal details
    router.get("/v1/tokenomics/proposals/:proposalId", authenticate, (req, res) => {
        try {
            const { proposalId } = req.params;
            const proposal = tokenomicsEngine.getFundingProposal(proposalId);
            const contributions = tokenomicsEngine.getContributions(proposalId);
            const result = tokenomicsEngine.getFundingResult(proposalId);

            if (!proposal) {
                return res.status(404).json({ error: 'Proposal not found' });
            }

            res.json({ proposal, contributions, result });
        } catch (error) {
            console.error('Tokenomics proposal query error:', error);
            res.status(500).json({ error: 'Failed to get proposal data' });
        }
    });

    // Get all active proposals
    router.get("/v1/tokenomics/proposals", authenticate, (req, res) => {
        try {
            const proposals = tokenomicsEngine.getActiveProposals();
            res.json({ proposals });
        } catch (error) {
            console.error('Tokenomics active proposals error:', error);
            res.status(500).json({ error: 'Failed to get active proposals' });
        }
    });

    // Get tokenomics metrics
    router.get("/v1/tokenomics/metrics", authenticate, (req, res) => {
        try {
            const metrics = tokenomicsEngine.getMetrics();
            const report = tokenomicsEngine.generateTransparencyReport();
            res.json({ metrics, report });
        } catch (error) {
            console.error('Tokenomics metrics error:', error);
            res.status(500).json({ error: 'Failed to get tokenomics metrics' });
        }
    });

    return router;
}
