import { Router } from "express";

export function createChatRoutes() {
    const router = Router();

    router.post("/v1/chat", (req, res) => {
        const { content } = req.body;

        // Mock chat response
        res.json({
            sender: "ai",
            content: `I received your message: "${content}". I am currently in maintenance mode, but I can confirm authentication is working!`
        });
    });

    router.get("/v1/chat/history", (req, res) => {
        res.json([
            { sender: "system", content: "Welcome to NeuroSwarm! System is online." }
        ]);
    });

    router.post("/v1/adapter/query", (req, res) => {
        const { adapter, params } = req.body;

        // Mock adapter response for Quick Actions
        res.json({
            success: true,
            adapter: adapter,
            data: {
                results: [
                    { title: "Mock Result", description: "This is a placeholder response. Adapter integration coming soon!" }
                ]
            }
        });
    });

    return router;
}
