import { Router } from "express";
import { Ollama } from "ollama";

const ollama = new Ollama({ host: 'http://localhost:11434' });

export function createChatRoutes() {
    const router = Router();

    router.post("/v1/chat", async (req, res) => {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: "content is required" });
        }

        try {
            // Call Ollama for AI response
            const response = await ollama.chat({
                model: 'llama3.2',
                messages: [{ role: 'user', content }],
                stream: false
            });

            res.json({
                sender: "ai",
                content: response.message.content
            });
        } catch (error: any) {
            console.error('Ollama error:', error);
            // Fallback to mock response if Ollama fails
            res.json({
                sender: "ai",
                content: `I received your message: "${content}". However, I'm having trouble connecting to the AI service. Please make sure Ollama is running with the llama3.2 model.`
            });
        }
    });

    router.get("/v1/chat/history", (req, res) => {
        res.json([
            { sender: "system", content: "Welcome to NeuroSwarm! AI is online and ready to chat!" }
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
