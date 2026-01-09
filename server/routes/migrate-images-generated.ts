import { Router, Request, Response } from "express";
import { HistoryService } from "../services/historyService";

const router = Router();
const historyService = new HistoryService();

/**
 * POST /api/migrate-images-generated
 * Backfill imagesGenerated flag for entries that have Sanity presentations
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("🔄 Starting imagesGenerated migration...");
    
    const allEntries = historyService.getAllEntries();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const entry of allEntries) {
      try {
        // Skip if already has imagesGenerated flag set
        if (entry.imagesGenerated === true) {
          skippedCount++;
          continue;
        }

        // If entry has a sanityPresentationId, it means mockups were generated
        if (entry.sanityPresentationId) {
          historyService.updateEntry(entry.id, {
            imagesGenerated: true,
          });
          console.log(`✅ Marked ${entry.companyName} as having generated images`);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${entry.companyName}:`, error.message);
      }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${allEntries.length}`);

    res.json({
      success: true,
      message: "Migration complete",
      stats: {
        updated: updatedCount,
        skipped: skippedCount,
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
