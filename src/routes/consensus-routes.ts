import { Router } from 'express';
import { ConsensusEngine } from '../consensus/consensus-engine.js';
import { SecureCommunicationFramework } from '../communication/index.js';

export function createConsensusRoutes(
    consensusEngine: ConsensusEngine,
    secureCommunication: SecureCommunicationFramework,
    authenticate: any
): Router {
    const router = Router();

    // --- Consensus Routes ---

    // Propose a validation
    router.post("/v1/consensus/propose", authenticate, async (req, res) => {
        try {
            const proposal = req.body;
            // Ensure proposerId matches authenticated user
            if (proposal.proposerId !== (req as any).user.username) {
                return res.status(403).json({ error: 'Proposer ID must match authenticated user' });
            }

            const proposalId = await consensusEngine.proposeValidation(proposal);
            res.status(201).json({ proposalId });
        } catch (error) {
            console.error('Consensus proposal error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create proposal' });
        }
    });

    // Cast a vote
    router.post("/v1/consensus/vote", authenticate, async (req, res) => {
        try {
            const vote = req.body;
            // Ensure voterId matches authenticated user
            if (vote.voterId !== (req as any).user.username) {
                return res.status(403).json({ error: 'Voter ID must match authenticated user' });
            }

            await consensusEngine.castVote(vote);
            res.json({ status: 'vote_cast' });
        } catch (error) {
            console.error('Consensus voting error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to cast vote' });
        }
    });

    // Get consensus status/metrics
    router.get("/v1/consensus/status", authenticate, (req, res) => {
        try {
            const metrics = consensusEngine.getMetrics();
            const activeProposals = consensusEngine.getActiveProposals();
            res.json({ metrics, activeProposals });
        } catch (error) {
            console.error('Consensus status error:', error);
            res.status(500).json({ error: 'Failed to get consensus status' });
        }
    });

    // Get specific proposal outcome
    router.get("/v1/consensus/proposals/:proposalId", authenticate, async (req, res) => {
        try {
            const { proposalId } = req.params;
            const outcome = await consensusEngine.getConsensusOutcome(proposalId);
            const stats = consensusEngine.getVotingStats(proposalId);

            if (!outcome && !stats) {
                return res.status(404).json({ error: 'Proposal not found' });
            }

            res.json({ outcome, stats });
        } catch (error) {
            console.error('Consensus proposal query error:', error);
            res.status(500).json({ error: 'Failed to get proposal data' });
        }
    });

    // --- Communication Routes ---

    // Establish a secure channel
    router.post("/v1/communication/channels", authenticate, async (req, res) => {
        try {
            const { peerId } = req.body;
            const channel = await secureCommunication.establishConnection(peerId);
            // Return channel info without sensitive keys
            const safeChannelInfo = {
                peerId: channel.peerId,
                protocolVersion: channel.protocolVersion,
                lastActivity: channel.lastActivity,
                authenticated: channel.authenticated
            };
            res.status(201).json({ channel: safeChannelInfo });
        } catch (error) {
            console.error('Channel establishment error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to establish channel' });
        }
    });

    // Send a secure message
    router.post("/v1/communication/send", authenticate, async (req, res) => {
        try {
            const { recipientId, payload, ttl } = req.body;
            const senderId = (req as any).user.username;

            const message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                senderId,
                recipientId,
                payload,
                timestamp: new Date(),
                ttl: ttl || 30000
            };

            const receipt = await secureCommunication.sendMessage(message);
            res.json({ receipt });
        } catch (error) {
            console.error('Message sending error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send message' });
        }
    });

    // Get communication metrics
    router.get("/v1/communication/metrics", authenticate, (req, res) => {
        try {
            const metrics = secureCommunication.getMetrics();
            res.json(metrics);
        } catch (error) {
            console.error('Communication metrics error:', error);
            res.status(500).json({ error: 'Failed to get communication metrics' });
        }
    });

    return router;
}
