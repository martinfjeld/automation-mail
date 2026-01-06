import { Request, Response } from "express";
import { configManager } from "../utils/configManager";
import { SanityService } from "../services/sanityService";
import progressController from "./progressController";
import * as fs from "fs";
import * as path from "path";

class FilesController {
  async uploadGeneratedFiles(req: Request, res: Response): Promise<void> {
    try {
      const { presentationId, industry, finalsPath, rendersPath, clientId } = req.body;

      if (!presentationId || !industry || !finalsPath || !rendersPath) {
        res.status(400).json({
          success: false,
          error: "presentationId, industry, finalsPath, and rendersPath are required",
        });
        return;
      }

      console.log("\n=== Uploading Generated Files ===");
      console.log("Presentation ID:", presentationId);
      console.log("Industry:", industry);
      console.log("Finals Path:", finalsPath);
      console.log("Renders Path:", rendersPath);

      if (clientId) {
        progressController.sendProgress(clientId, "Uploading files to Sanity...");
      }

      const config = configManager.getConfig();
      
      if (!config.SANITY_PROJECT_ID || !config.SANITY_DATASET || !config.SANITY_TOKEN) {
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

      // Map industry to file prefixes
      const industryMap: { [key: string]: string } = {
        Helse: "Health",
        Advokat: "Lawyer",
        Bygg: "Construction",
      };

      const industryPrefix = industryMap[industry];
      if (!industryPrefix) {
        res.status(400).json({
          success: false,
          error: `Invalid industry: ${industry}`,
        });
        return;
      }

      // Read mockup images
      const mockupFiles: { [key: string]: Buffer } = {};
      const mockupMapping = {
        "1_mockup.jpg": "first_fullscreen",
        "2_mockup.jpg": "A",
        "3_mockup.jpg": "E",
        "4_mockup.jpg": "C",
      };

      for (const filename of Object.keys(mockupMapping)) {
        const filePath = path.join(finalsPath, filename);
        if (fs.existsSync(filePath)) {
          mockupFiles[filename] = fs.readFileSync(filePath);
          console.log(`✓ Read ${filename}`);
        } else {
          console.warn(`⚠ Missing ${filename} at ${filePath}`);
        }
      }

      // Read before/after images
      const beforeAfterFiles: { [key: string]: Buffer } = {};
      const beforeAfterFilenames = ["1.jpg", "2.jpg"];

      for (const filename of beforeAfterFilenames) {
        const filePath = path.join(finalsPath, filename);
        if (fs.existsSync(filePath)) {
          beforeAfterFiles[filename] = fs.readFileSync(filePath);
          console.log(`✓ Read ${filename}`);
        } else {
          console.warn(`⚠ Missing ${filename} at ${filePath}`);
        }
      }

      // Read video files
      const videoFiles: { [key: string]: Buffer } = {};
      const videoFilenames = [
        `${industryPrefix}_template.mp4`,
        `${industryPrefix}_template_mobile.mp4`,
      ];

      for (const filename of videoFilenames) {
        const filePath = path.join(rendersPath, filename);
        if (fs.existsSync(filePath)) {
          videoFiles[filename] = fs.readFileSync(filePath);
          console.log(`✓ Read ${filename}`);
        } else {
          console.warn(`⚠ Missing ${filename} at ${filePath}`);
        }
      }

      // Upload to Sanity
      await sanityService.uploadGeneratedFiles(
        presentationId,
        mockupFiles,
        beforeAfterFiles,
        videoFiles,
        industryPrefix,
        clientId
      );

      res.json({
        success: true,
        message: "Files uploaded successfully",
        uploadedFiles: {
          mockups: Object.keys(mockupFiles),
          beforeAfter: Object.keys(beforeAfterFiles),
          videos: Object.keys(videoFiles),
        },
      });
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to upload generated files",
      });
    }
  }
}

const filesController = new FilesController();
export default filesController;
