import { Router, Request, Response } from "express";
import { HistoryService } from "../services/historyService";
import { NotionService } from "../services/notionService";

const router = Router();
const historyService = new HistoryService();

/**
 * POST /api/migrate-proff-urls
 * Migrate proffLink from Notion to history entries
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("🔄 Starting proffUrl migration...");

    // Get Notion credentials from environment
    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken || !notionDatabaseId) {
      return res.status(500).json({
        success: false,
        error: "Notion credentials not configured",
      });
    }

    const notionService = new NotionService(notionToken, notionDatabaseId);

    const allEntries = historyService.getAllEntries();
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const entry of allEntries) {
      try {
        // Skip if already has proffUrl
        if (entry.proffUrl) {
          skippedCount++;
          continue;
        }

        // Fetch from Notion
        console.log(`📥 Fetching ${entry.companyName} from Notion...`);

        // Retrieve the page directly from Notion client
        const page = await (notionService as any).client.pages.retrieve({
          page_id: entry.notionPageId,
        });

        // Extract proffLink from properties
        const properties = (page as any).properties;
        const proffLink = properties["Proff-link"]?.url;

        if (proffLink) {
          // Update history with proffUrl
          historyService.updateEntry(entry.id, {
            proffUrl: proffLink,
          });
          console.log(`✅ Updated ${entry.companyName} with proffUrl`);
          updatedCount++;
        } else {
          console.log(`⚠️ No proffLink found for ${entry.companyName}`);
          skippedCount++;
        }
      } catch (error: any) {
        console.error(
          `❌ Error processing ${entry.companyName}:`,
          error.message
        );
        errorCount++;
      }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);

    res.json({
      success: true,
      message: "Migration complete",
      stats: {
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: allEntries.length,
      },
    });
  } catch (error: any) {
    console.error("Migration error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Migration failed",
    });
  }
});

export default router;
