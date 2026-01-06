import { Router, Request, Response } from "express";
import { HistoryService } from "../services/historyService";
import { NotionService } from "../services/notionService";
import { SanityService } from "../services/sanityService";

const router = Router();
const historyService = new HistoryService();

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
            return {
              ...entry,
              emailContent: page.emailContent,
              industry: page.industry,
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

export default router;
