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

    return router;
}
