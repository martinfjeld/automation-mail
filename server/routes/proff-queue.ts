import { Router, Request, Response } from "express";
import { ProffQueueService } from "../services/proffQueueService";
import { ScraperService } from "../services/scraperService";
import { BanListService } from "../services/banListService";

const router = Router();
const queueService = new ProffQueueService();
const banListService = new BanListService();

/**
 * GET /api/proff-queue
 * Get current queue (filtered by history)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const queue = queueService.getQueue();
    const queueData = queueService.getQueueData();

    res.json({
      success: true,
      queue,
      metadata: {
        lastScrapedCompany: queueData.lastScrapedCompany,
        currentPage: queueData.currentPage,
        searchUrl: queueData.searchUrl,
      },
    });
  } catch (error: any) {
    console.error("Get queue error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get queue",
    });
  }
});

/**
 * POST /api/proff-queue/refill
 * Fetch more companies from Proff search and add to queue
 */
router.post("/refill", async (req: Request, res: Response) => {
  try {
    const queueData = queueService.getQueueData();
    const currentQueue = queueService.getQueue();

    // If we already have 10+ companies, no need to refill
    if (currentQueue.length >= 10) {
      return res.json({
        success: true,
        message: "Queue already has enough companies",
        added: 0,
      });
    }

    console.log(`📥 Refilling queue from page ${queueData.currentPage}...`);

    const scraperService = new ScraperService();
    const searchUrl = queueService.getSearchUrl(queueData.currentPage);
    const companies = await scraperService.scrapeProffSearchResults(searchUrl);

    if (companies.length === 0) {
      return res.json({
        success: true,
        message: "No more companies found",
        added: 0,
      });
    }

    // Add companies to queue (service handles deduplication)
    const beforeCount = queueService.getQueue().length;
    queueService.addToQueue(companies);
    const afterCount = queueService.getQueue().length;
    const added = afterCount - beforeCount;

    // Update progress
    const lastCompany = companies[companies.length - 1];
    queueService.updateProgress(
      lastCompany.companyName,
      queueData.currentPage + 1
    );

    res.json({
      success: true,
      message: `Added ${added} companies to queue`,
      added,
      totalInQueue: afterCount,
    });
  } catch (error: any) {
    console.error("Refill queue error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to refill queue",
    });
  }
});

/**
 * DELETE /api/proff-queue/:id
 * Remove company from queue
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    queueService.removeFromQueue(id);

    res.json({
      success: true,
      message: "Company removed from queue",
    });
  } catch (error: any) {
    console.error("Remove from queue error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to remove from queue",
    });
  }
});

/**
 * POST /api/proff-queue/reset
 * Reset queue (clear all data)
 */
router.post("/reset", async (req: Request, res: Response) => {
  try {
    queueService.reset();

    res.json({
      success: true,
      message: "Queue reset successfully",
    });
  } catch (error: any) {
    console.error("Reset queue error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reset queue",
    });
  }
});

/**
 * PUT /api/proff-queue/search-url
 * Update the search URL
 */
router.put("/search-url", async (req: Request, res: Response) => {
  try {
    const { searchUrl } = req.body;

    if (!searchUrl || typeof searchUrl !== "string") {
      return res.status(400).json({
        success: false,
        error: "Search URL is required and must be a string",
      });
    }

    queueService.updateSearchUrl(searchUrl);

    res.json({
      success: true,
      message: "Search URL updated successfully",
      searchUrl,
    });
  } catch (error: any) {
    console.error("Update search URL error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update search URL",
    });
  }
});

/**
 * POST /api/proff-queue/ban
 * Ban a company (add to ban list and remove from queue)
 */
router.post("/ban", async (req: Request, res: Response) => {
  try {
    const { id, proffUrl, companyName } = req.body;

    if (!id || !proffUrl || !companyName) {
      return res.status(400).json({
        success: false,
        error: "id, proffUrl, and companyName are required",
      });
    }

    // Add to ban list
    banListService.addToBanList(proffUrl, companyName);

    // Remove from queue
    queueService.removeFromQueue(id);

    res.json({
      success: true,
      message: `${companyName} has been banned and removed from queue`,
    });
  } catch (error: any) {
    console.error("Ban company error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to ban company",
    });
  }
});

export default router;
