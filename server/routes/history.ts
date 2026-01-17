import { Router, Request, Response } from "express";
import { HistoryService } from "../services/historyService";
import { NotionService } from "../services/notionService";
import { SanityService } from "../services/sanityService";
import { UrlShortenerService } from "../services/urlShortenerService";
import { ProposedMeetingsService } from "../services/proposedMeetingsService";
import { BanListService } from "../services/banListService";
import * as fs from "fs";
import * as path from "path";

const router = Router();
const historyService = new HistoryService();
const banListService = new BanListService();

// Auto-sync from production in development mode
if (process.env.NODE_ENV === "development") {
  const SYNC_INTERVAL = 15000; // 15 seconds
  const PRODUCTION_URL =
    process.env.PRODUCTION_BACKEND_URL ||
    "https://automation-mail-zk8t.onrender.com";

  const syncFromProduction = async () => {
    try {
      console.log("🔄 Fetching data from production...");
      const response = await fetch(`${PRODUCTION_URL}/api/history`);
      if (response.ok) {
        const data = (await response.json()) as {
          success: boolean;
          data: any[];
        };
        const productionEntries = data.data || [];
        console.log(
          `📥 Received ${productionEntries.length} entries from production`
        );

        // Merge production entries into local history
        const localEntries = historyService.getAllEntries();
        const localMap = new Map(localEntries.map((e) => [e.id, e]));
        console.log(`📋 Local history has ${localEntries.length} entries`);

        let added = 0;
        let updated = 0;
        for (const prodEntry of productionEntries) {
          const localEntry = localMap.get(prodEntry.id);

          if (!localEntry) {
            // Entry doesn't exist locally, add it with all fields
            historyService.addCompleteEntry(prodEntry);
            added++;
          } else if (prodEntry.updatedAt > localEntry.updatedAt) {
            // Entry exists but production is newer, update it
            historyService.updateEntry(prodEntry.id, prodEntry);
            updated++;
          }
        }

        if (added > 0 || updated > 0) {
          console.log(
            `✅ Synced from production: ${added} added, ${updated} updated`
          );
        } else {
          console.log("✓ Local history is up to date");
        }
      } else {
        console.error(`⚠️ Production API returned status: ${response.status}`);
      }
    } catch (error: any) {
      console.error("⚠️ Production sync failed:", error.message);
    }
  };

  // Run sync immediately on startup
  syncFromProduction();

  // Then run on interval
  setInterval(syncFromProduction, SYNC_INTERVAL);

  console.log(
    `🔄 Auto-sync from production enabled (every ${SYNC_INTERVAL / 1000}s)`
  );
}

// Get all history entries
router.get("/", async (req: Request, res: Response) => {
  try {
    const entries = historyService.getAllEntries();

    // DISABLED: Notion enrichment causes rate limiting when loading many entries
    // history.json is now the source of truth
    // Use "Refresh notion" button on individual entries to sync changes manually

    res.json({
      success: true,
      data: entries,
    });
  } catch (error: any) {
    console.error("Get history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get history",
    });
  }
});

// Update history entry (local only, no Notion/Sanity sync)
router.patch("/", async (req: Request, res: Response) => {
  try {
    const {
      pageId,
      companyName,
      email,
      phone,
      address,
      city,
      linkedIn,
      meetingDates,
      logoMode,
    } = req.body;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: "Page ID is required",
      });
    }

    const updates: any = {};
    if (companyName !== undefined) updates.companyName = companyName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (linkedIn !== undefined) updates.linkedIn = linkedIn;
    if (meetingDates !== undefined) updates.meetingDates = meetingDates;
    if (logoMode !== undefined) updates.logoMode = logoMode;

    console.log(`📝 Updating history for pageId: ${pageId}`, updates);
    historyService.updateEntry(pageId, updates);
    console.log(`✅ History updated for pageId: ${pageId}`);

    res.json({
      success: true,
      message: "History updated",
    });
  } catch (error: any) {
    console.error("Update history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update history",
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

    // Delete associated short URL codes
    if (entry.bookingLinks && entry.bookingLinks.length > 0) {
      try {
        const urlShortener = new UrlShortenerService();
        // Extract codes from full URLs (e.g., "www.no-offence.io/s/abc123" -> "abc123")
        const codes = entry.bookingLinks.map((link: string) => {
          const match = link.match(/\/s\/([a-f0-9]+)$/);
          return match ? match[1] : link;
        });
        urlShortener.deleteCodes(codes);
        console.log("✅ Deleted associated short URLs:", codes);
      } catch (error: any) {
        console.error("Failed to delete short URLs:", error.message);
        errors.push(`Short URLs: ${error.message}`);
      }
    }

    // Delete associated proposed meeting times
    if (entry.notionPageId) {
      try {
        const proposedMeetingsService = new ProposedMeetingsService();
        proposedMeetingsService.removeProposedTimes(entry.notionPageId);
        console.log(
          "✅ Deleted proposed meeting times for:",
          entry.notionPageId
        );
      } catch (error: any) {
        console.error("Failed to delete proposed times:", error.message);
        errors.push(`Proposed times: ${error.message}`);
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

    // Add to ban list if proffUrl exists
    if (entry.proffUrl) {
      try {
        banListService.addToBanList(entry.proffUrl, entry.companyName);
        console.log(`🚫 Added to ban list: ${entry.companyName}`);
      } catch (error: any) {
        console.error("Failed to add to ban list:", error.message);
        errors.push(`Ban list: ${error.message}`);
      }
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
