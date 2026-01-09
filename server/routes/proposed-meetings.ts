import { Router, Request, Response } from "express";
import { ProposedMeetingsService } from "../services/proposedMeetingsService";

const router = Router();
const proposedMeetingsService = new ProposedMeetingsService();

/**
 * GET /api/proposed-meetings
 * Get all taken meeting times (flat array)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const takenTimes = proposedMeetingsService.getTakenTimes();
    res.json({ takenTimes });
  } catch (error) {
    console.error("Error getting taken times:", error);
    res.status(500).json({ error: "Failed to get taken times" });
  }
});

/**
 * GET /api/proposed-meetings/entries
 * Get all proposed meeting entries (with company names)
 */
router.get("/entries", async (req: Request, res: Response) => {
  try {
    const entries = proposedMeetingsService.getAllEntries();
    res.json({ entries });
  } catch (error) {
    console.error("Error getting proposed meeting entries:", error);
    res.status(500).json({ error: "Failed to get entries" });
  }
});

/**
 * POST /api/proposed-meetings
 * Add proposed times for an entry
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { notionPageId, companyName, meetingTimes } = req.body;

    if (!notionPageId || !companyName || !Array.isArray(meetingTimes)) {
      return res.status(400).json({
        error:
          "Missing required fields: notionPageId, companyName, meetingTimes",
      });
    }

    proposedMeetingsService.addProposedTimes(
      notionPageId,
      companyName,
      meetingTimes
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding proposed times:", error);
    res.status(500).json({ error: "Failed to add proposed times" });
  }
});

/**
 * DELETE /api/proposed-meetings/:notionPageId
 * Remove proposed times for an entry
 */
router.delete("/:notionPageId", async (req: Request, res: Response) => {
  try {
    const { notionPageId } = req.params;

    proposedMeetingsService.removeProposedTimes(notionPageId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing proposed times:", error);
    res.status(500).json({ error: "Failed to remove proposed times" });
  }
});

/**
 * PUT /api/proposed-meetings/:notionPageId
 * Update proposed times for an entry
 */
router.put("/:notionPageId", async (req: Request, res: Response) => {
  try {
    const { notionPageId } = req.params;
    const { meetingTimes } = req.body;

    if (!Array.isArray(meetingTimes)) {
      return res.status(400).json({
        error: "Missing required field: meetingTimes (array)",
      });
    }

    proposedMeetingsService.updateProposedTimes(notionPageId, meetingTimes);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating proposed times:", error);
    res.status(500).json({ error: "Failed to update proposed times" });
  }
});

export default router;
