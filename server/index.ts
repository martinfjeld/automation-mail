import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import setupRoutes from "./routes/setup";
import generateRoutes from "./routes/generate";
import { errorHandler } from "./middleware/errorHandler";

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware - relaxed for development
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
}
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// API Routes
app.use("/api/setup", setupRoutes);
app.use("/api/generate", generateRoutes);

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
