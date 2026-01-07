import { Router, Request, Response } from "express";
import { HistoryService } from "../services/historyService";
import { NotionService } from "../services/notionService";
import { SanityService } from "../services/sanityService";
import * as fs from "fs";
import * as path from "path";

const router = Router();
const historyService = new HistoryService();

// Auto-sync from production in development mode
if (process.env.NODE_ENV === "development") {
  const SYNC_INTERVAL = 15000; // 15 seconds
  const PRODUCTION_URL =
    process.env.PRODUCTION_BACKEND_URL ||
    "https://automation-mail-zk8t.onrender.com";

  setInterval(async () => {
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/history`);
      if (response.ok) {
        const data = (await response.json()) as {
          success: boolean;
          data: any[];
        };
        const productionEntries = data.data || [];

        // Merge production entries into local history
        const localEntries = historyService.getAllEntries();
        const localMap = new Map(localEntries.map((e) => [e.id, e]));

        let updated = false;
        for (const prodEntry of productionEntries) {
          const localEntry = localMap.get(prodEntry.id);

          // Debug log for first entry
          if (prodEntry.id === "2e15fc42-3c97-8184-a200-cb821dc1e4c5") {
            console.log("🔍 Production entry:", {
              leadStatus: prodEntry.leadStatus,
              bookedSlotIndex: prodEntry.bookedSlotIndex,
              updatedAt: prodEntry.updatedAt,
            });
            if (localEntry) {
              console.log("🔍 Local entry:", {
                leadStatus: localEntry.leadStatus,
                bookedSlotIndex: localEntry.bookedSlotIndex,
                updatedAt: localEntry.updatedAt,
              });
            }
          }

          if (!localEntry || prodEntry.updatedAt > localEntry.updatedAt) {
            historyService.updateEntry(prodEntry.id, prodEntry);
            updated = true;
          }
        }

        if (updated) {
          console.log("🔄 Synced updates from production");
        }
      }
    } catch (error: any) {
      console.error("⚠️ Production sync failed:", error.message);
    }
  }, SYNC_INTERVAL);

  console.log(
    `🔄 Auto-sync from production enabled (every ${SYNC_INTERVAL / 1000}s)`
  );
}

// Get all history entries
router.get("/", async (req: Request, res: Response) => {
  try {
    const entries = historyService.getAllEntries();

    // Enrich entries with data from Notion
    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (notionToken && notionDatabaseId) {
      const notionService = new NotionService(notionToken, notionDatabaseId);

      // Fetch additional data from Notion for each entry
      const enrichedEntries = await Promise.all(
        entries.map(async (entry) => {
          try {
            const page = await notionService.getPageProperties(
              entry.notionPageId
            );

            // Check if we need to sync data back to history.json
            let needsUpdate = false;
            const updates: any = {};

            if (page.leadStatus && page.leadStatus !== entry.leadStatus) {
              updates.leadStatus = page.leadStatus;
              needsUpdate = true;
            }

            if (page.møtedato && page.møtedato !== entry.møtedato) {
              updates.møtedato = page.møtedato;
              needsUpdate = true;
            }

            if (
              page.bookedSlotIndex !== undefined &&
              page.bookedSlotIndex !== entry.bookedSlotIndex
            ) {
              updates.bookedSlotIndex = page.bookedSlotIndex;
              needsUpdate = true;
            }

            // Sync changes back to history.json
            if (needsUpdate) {
              console.log(
                `🔄 Syncing Notion changes to history for ${entry.companyName}:`,
                updates
              );
              historyService.updateEntry(entry.id, updates);
            }

            return {
              ...entry,
              emailContent: page.emailContent,
              industry: page.industry,
              leadStatus: page.leadStatus || entry.leadStatus,
              bookedSlotIndex: page.bookedSlotIndex ?? entry.bookedSlotIndex,
              møtedato: page.møtedato || entry.møtedato,
            };
          } catch (error) {
            console.error(
              `Failed to fetch Notion data for ${entry.id}:`,
              error
            );
            return entry; // Return entry without enrichment if fetch fails
          }
        })
      );

      res.json({
        success: true,
        data: enrichedEntries,
      });
    } else {
      res.json({
        success: true,
        data: entries,
      });
    }
  } catch (error: any) {
    console.error("Get history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get history",
    });
  }
});

// Delete an entry (from Notion, Sanity, and history)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the entry from history
    const entry = historyService.getEntryById(id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "Entry not found in history",
      });
    }

    const errors: string[] = [];

    // Delete from Notion
    if (entry.notionPageId) {
      const notionToken = process.env.NOTION_TOKEN;
      const notionDatabaseId = process.env.NOTION_DATABASE_ID;

      if (notionToken && notionDatabaseId) {
        try {
          const notionService = new NotionService(
            notionToken,
            notionDatabaseId
          );
          await notionService.deleteEntry(entry.notionPageId);
          console.log("✅ Deleted from Notion");
        } catch (error: any) {
          console.error("Failed to delete from Notion:", error.message);
          errors.push(`Notion: ${error.message}`);
        }
      }
    }

    // Delete from Sanity
    if (entry.sanityPresentationId) {
      const sanityProjectId = process.env.SANITY_PROJECT_ID;
      const sanityDataset = process.env.SANITY_DATASET || "production";
      const sanityToken = process.env.SANITY_TOKEN;

      if (sanityProjectId && sanityToken) {
        try {
          const sanityService = new SanityService(
            sanityProjectId,
            sanityDataset,
            sanityToken
          );
          await sanityService.deletePresentation(entry.sanityPresentationId);
          console.log("✅ Deleted from Sanity");
        } catch (error: any) {
          console.error("Failed to delete from Sanity:", error.message);
          errors.push(`Sanity: ${error.message}`);
        }
      }
    }

    // Delete from history
    const deleted = historyService.deleteEntry(id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: "Failed to delete from history",
      });
    }

    res.json({
      success: true,
      message: "Entry deleted successfully",
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Delete entry error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete entry",
    });
  }
});

// Upload/sync history entries from local to production
router.post("/upload", async (req: Request, res: Response) => {
  try {
    console.log("📥 Upload request received");
    console.log("Body keys:", Object.keys(req.body));
    console.log("Body:", JSON.stringify(req.body).substring(0, 200));

    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      console.error(
        "❌ Invalid entries:",
        typeof entries,
        Array.isArray(entries)
      );
      return res.status(400).json({
        success: false,
        error: `Invalid request: entries array required. Got: ${typeof entries}`,
      });
    }

    console.log(`📤 Processing upload for ${entries.length} entries`);

    const persistentPath = process.env.PERSISTENT_STORAGE_PATH;
    const historyPath = persistentPath
      ? path.join(persistentPath, "history.json")
      : path.join(process.cwd(), "history.json");

    console.log(`📁 Writing to: ${historyPath}`);

    fs.writeFileSync(historyPath, JSON.stringify(entries, null, 2));

    console.log(
      `✅ Successfully wrote ${entries.length} entries to ${historyPath}`
    );

    res.json({
      success: true,
      count: entries.length,
      message: `Successfully uploaded ${entries.length} entries to production`,
    });
  } catch (error: any) {
    console.error("❌ Upload entries error:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload entries",
      stack: error.stack,
    });
  }
});

export default router;
