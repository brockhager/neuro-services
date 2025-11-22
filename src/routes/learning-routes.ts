import { Router } from 'express';
import { LearningService } from '../learning/learning-service.js';

export function createLearningRoutes(learningService: LearningService): Router {
    const router = Router();

    router.post('/learning/reload', async (_req, res) => {
        try {
            await learningService.ingestLogs();
            await learningService.generateEmbeddings();
            res.json({ status: 'reloaded' });
        } catch (error) {
            console.error('Learning reload error:', error);
            res.status(500).json({ error: 'Failed to reload learning artifacts' });
        }
    });

    router.post('/learning/recommend', async (req, res) => {
        const { query } = req.body || {};
        if (!query) {
            return res.status(400).json({ error: 'query_required' });
        }

        try {
            const result = await learningService.getRecommendations(query);
            res.json(result);
        } catch (error) {
            console.error('Learning recommendation error:', error);
            res.status(500).json({ error: 'Failed to build recommendation' });
        }
    });

    router.get('/learning/gaps', (_req, res) => {
        try {
            const gaps = learningService.identifyKnowledgeGaps();
            res.json({ gaps });
        } catch (error) {
            console.error('Learning gap inspection error:', error);
            res.status(500).json({ error: 'Failed to enumerate gaps' });
        }
    });

    return router;
}
