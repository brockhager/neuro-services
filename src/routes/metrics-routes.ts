import { Router } from 'express';
import { register } from 'prom-client';

export function createMetricsRoutes(): Router {
    const router = Router();

    router.get('/metrics', async (req, res) => {
        try {
            const metrics = await register.metrics();
            res.set('Content-Type', register.contentType);
            res.end(metrics);
        } catch (ex) {
            res.status(500).end(ex);
        }
    });

    return router;
}
