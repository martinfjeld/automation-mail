import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import setupRoutes from "./routes/setup";
import generateRoutes from "./routes/generate";
import updateRoutes from "./routes/update";
import screenshotsRoutes from "./routes/screenshots";
import uploadRoutes from "./routes/upload";
import automationRoutes from "./routes/automation";
import filesRoutes from "./routes/files";
import progressRoutes from "./routes/progress";
import historyRoutes from "./routes/history";
import calendarRoutes from "./routes/calendar";
import shortRoutes from "./routes/short";
import shortUrlsRoutes from "./routes/short-urls";
import bookingRoutes from "./routes/booking";
import proposedMeetingsRoutes from "./routes/proposed-meetings";
import proffQueueRoutes from "./routes/proff-queue";
import migrateProffUrlsRoutes from "./routes/migrate-proff-urls";
import migrateImagesGeneratedRoutes from "./routes/migrate-images-generated";
import syncRoutes from "./routes/sync";
import sanityRoutes from "./routes/sanity";
import { errorHandler } from "./middleware/errorHandler";
import { AutoSyncService } from "./services/autoSyncService";

// Load .env file from project root - try multiple paths for robustness
const envPath = path.resolve(__dirname, "../.env");
const envDevPath = path.resolve(__dirname, "../.env.development");
const envProdPath = path.resolve(__dirname, "../.env.production");

// Load in order: .env, .env.development, .env.production
dotenv.config({ path: envPath });
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: envDevPath, override: true });
} else if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: envProdPath, override: true });
}

const app: Application = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;

// Trust proxy - required when running behind Render's reverse proxy
app.set("trust proxy", 1);

// Middleware - relaxed for development
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
}
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://martinfjeld.github.io",
            "https://martinfjeld.io",
            "https://www.martinfjeld.io",
            "https://no-offence.io",
            "https://www.no-offence.io",
            "http://localhost:3000",
            "https://localhost:3000",
          ]
        : "http://localhost:3000",
    credentials: true,
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// API Routes
app.use("/api/setup", setupRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/update", updateRoutes);
app.use("/api/screenshots", screenshotsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/booking", bookingRoutes); // Booking confirmations
app.use("/book", calendarRoutes); // Shorter alias: /book/:token instead of /api/calendar/:token
app.use("/s", shortRoutes); // Short URL redirects: /s/:code
app.use("/api/short-urls", shortUrlsRoutes); // API to create short URLs
app.use("/api/sync", syncRoutes); // Auto-sync with production
app.use("/api/sanity", sanityRoutes); // Sanity-specific operations
app.use("/api/proposed-meetings", proposedMeetingsRoutes); // Track proposed meeting times
app.use("/api/proff-queue", proffQueueRoutes); // Proff company queue
app.use("/api/migrate-proff-urls", migrateProffUrlsRoutes); // Migrate proffUrl to history
app.use("/api/migrate-images-generated", migrateImagesGeneratedRoutes); // Backfill imagesGenerated flag

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

  // Start automatic syncing with production
  const autoSync = AutoSyncService.getInstance();
  autoSync.startAutoSync();
});

export default app;
