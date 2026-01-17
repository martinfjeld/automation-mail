import { Router, Request, Response } from "express";
import { AutoSyncService } from "../services/autoSyncService";

const router = Router();

/**
 * GET /api/sync/status
 * Get current auto-sync status
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const autoSync = AutoSyncService.getInstance();
    const status = autoSync.getSyncStatus();

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get sync status",
    });
  }
});

/**
 * POST /api/sync/trigger
 * Manually trigger a sync with production
 */
router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const autoSync = AutoSyncService.getInstance();
    const synced = await autoSync.syncWithProduction();

    res.json({
      success: true,
      synced,
      message: synced
        ? "Successfully synced with production"
        : "Already up to date",
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger sync",
    });
  }
});

export default router;
