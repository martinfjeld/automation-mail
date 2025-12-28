import { Router, Request, Response } from "express";
import { NotionService } from "../services/notionService";

const router = Router();

router.patch("/", async (req: Request, res: Response) => {
  try {
    const { pageId, email, phone } = req.body;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: "Page ID is required",
      });
    }

    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken || !notionDatabaseId) {
      return res.status(500).json({
        success: false,
        error: "Notion configuration missing",
      });
    }

    const notionService = new NotionService(notionToken, notionDatabaseId);

    const updates: { email?: string; phone?: string } = {};
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    await notionService.updateEntry(pageId, updates);

    res.json({
      success: true,
      message: "Notion entry updated successfully",
    });
  } catch (error: any) {
    console.error("Update error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update Notion entry",
    });
  }
});

export default router;
