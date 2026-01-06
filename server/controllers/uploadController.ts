import { Request, Response } from "express";
import { configManager } from "../utils/configManager";
import { SanityService } from "../services/sanityService";

class UploadController {
  async uploadMockups(req: Request, res: Response): Promise<void> {
    try {
      const { presentationId, images } = req.body;

      if (!presentationId) {
        res.status(400).json({
          success: false,
          error: "Presentation ID is required",
        });
        return;
      }

      if (!images || !Array.isArray(images) || images.length === 0) {
        res.status(400).json({
          success: false,
          error: "At least one image is required",
        });
        return;
      }

      // Validate that all images have valid naming pattern
      const validNames = [
        "1_mockup.jpg",
        "2_mockup.jpg",
        "3_mockup.jpg",
        "4_mockup.jpg",
        "1.jpg",
        "2.jpg",
      ];
      const invalidImages = images.filter(
        (img: any) => !validNames.includes(img.filename)
      );

      if (invalidImages.length > 0) {
        res.status(400).json({
          success: false,
          error:
            "The image names needs to be of type mockup (1_mockup.jpg, 2_mockup.jpg, etc.) or before/after (1.jpg, 2.jpg)",
        });
        return;
      }

      // Initialize Sanity service
      const config = configManager.getConfig();

      if (
        !config.SANITY_PROJECT_ID ||
        !config.SANITY_DATASET ||
        !config.SANITY_TOKEN
      ) {
        res.status(500).json({
          success: false,
          error:
            "Sanity configuration missing. Please configure SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN in .env",
        });
        return;
      }

      const sanityService = new SanityService(
        config.SANITY_PROJECT_ID,
        config.SANITY_DATASET,
        config.SANITY_TOKEN
      );

      // Upload mockup images to Sanity and update imageLayout slide
      await sanityService.updateImageLayoutSlide(presentationId, images);

      res.json({
        success: true,
        message: "Mockup images uploaded successfully",
      });
    } catch (error: any) {
      console.error("Upload mockups failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to upload mockup images",
      });
    }
  }

  async uploadLogo(req: Request, res: Response): Promise<void> {
    try {
      const { presentationId, imageData, fileType, fileName } = req.body;

      console.log("📥 Logo upload request received:");
      console.log("  - Presentation ID:", presentationId);
      console.log("  - File type:", fileType);
      console.log("  - File name:", fileName);
      console.log("  - Image data length:", imageData?.length || 0);

      if (!presentationId) {
        res.status(400).json({
          success: false,
          error: "Presentation ID is required",
        });
        return;
      }

      if (!imageData) {
        res.status(400).json({
          success: false,
          error: "Image data is required",
        });
        return;
      }

      // Validate base64 data
      try {
        const buffer = Buffer.from(imageData, "base64");
        if (buffer.length === 0) {
          throw new Error("Empty buffer after base64 decode");
        }
        console.log(
          "  ✅ Base64 validation passed, buffer size:",
          buffer.length
        );
      } catch (err: any) {
        console.error("  ❌ Invalid base64 data:", err.message);
        res.status(400).json({
          success: false,
          error: "Invalid image data format",
        });
        return;
      }

      // Initialize Sanity service
      const config = configManager.getConfig();

      if (
        !config.SANITY_PROJECT_ID ||
        !config.SANITY_DATASET ||
        !config.SANITY_TOKEN
      ) {
        res.status(500).json({
          success: false,
          error: "Sanity configuration missing",
        });
        return;
      }

      const sanityService = new SanityService(
        config.SANITY_PROJECT_ID,
        config.SANITY_DATASET,
        config.SANITY_TOKEN
      );

      // Upload logo to Sanity and update presentation
      const logoUrl = await sanityService.uploadAndUpdateLogo(
        presentationId,
        imageData,
        fileType,
        fileName
      );

      res.json({
        success: true,
        message: "Logo uploaded successfully",
        logoUrl,
      });
    } catch (error: any) {
      console.error("Upload logo failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to upload logo",
      });
    }
  }

  async deleteLogo(req: Request, res: Response): Promise<void> {
    try {
      const { presentationId } = req.body;

      if (!presentationId) {
        res.status(400).json({
          success: false,
          error: "Presentation ID is required",
        });
        return;
      }

      // Initialize Sanity service
      const config = configManager.getConfig();

      if (
        !config.SANITY_PROJECT_ID ||
        !config.SANITY_DATASET ||
        !config.SANITY_TOKEN
      ) {
        res.status(500).json({
          success: false,
          error: "Sanity configuration missing",
        });
        return;
      }

      const sanityService = new SanityService(
        config.SANITY_PROJECT_ID,
        config.SANITY_DATASET,
        config.SANITY_TOKEN
      );

      // Remove logo from Sanity presentation
      await sanityService.removeLogo(presentationId);

      res.json({
        success: true,
        message: "Logo deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete logo failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete logo",
      });
    }
  }
}

export const uploadController = new UploadController();
