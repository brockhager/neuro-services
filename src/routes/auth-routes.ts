import { Router } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

export function createAuthRoutes() {
    const router = Router();

    router.post("/login", (req, res) => {
        const { username, password } = req.body;

        // Mock authentication for demo purposes
        // In a real app, this would check against a database
        if (username === "admin" && password === "password") {
            const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" });
            return res.json({ token });
        }

        return res.status(401).json({ error: "Invalid credentials" });
    });

    return router;
}
