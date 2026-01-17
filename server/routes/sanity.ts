import { Router, Request, Response } from "express";
import { SanityService } from "../services/sanityService";

const router = Router();

/**
 * GET /api/sanity/logo/:presentationId
 * Get company logo URL from Sanity presentation
 */
router.get("/logo/:presentationId", async (req: Request, res: Response) => {
  try {
    const { presentationId } = req.params;

    if (!presentationId) {
      return res.status(400).json({
        success: false,
        message: "Presentation ID is required",
      });
    }

    const sanityService = new SanityService(
      process.env.SANITY_PROJECT_ID!,
      process.env.SANITY_DATASET!,
      process.env.SANITY_TOKEN!
    );

    const logoUrl = await sanityService.getCompanyLogoUrl(presentationId);

    res.json({
      success: true,
      logoUrl,
    });
  } catch (error: any) {
    console.error("Error fetching logo from Sanity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch logo from Sanity",
      error: error.message,
    });
  }
});

/**
 * POST /api/sanity/bulk-update-client-titles
 * Bulk update client slide titles from "Klienter" to "Kunder"
 */
router.post("/bulk-update-client-titles", async (req: Request, res: Response) => {
  try {
    const sanityService = new SanityService(
      process.env.SANITY_PROJECT_ID!,
      process.env.SANITY_DATASET!,
      process.env.SANITY_TOKEN!
    );

    const result = await sanityService.bulkUpdateClientSlideTitles();

    res.json({
      success: true,
      message: `Successfully updated ${result.updated} out of ${result.total} presentations`,
      updated: result.updated,
      total: result.total,
    });
  } catch (error: any) {
    console.error("Error bulk updating client slide titles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk update client slide titles",
      error: error.message,
    });
  }
});

export default router;
