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
      
      // Check if paths exist
      if (!fs.existsSync(finalsPath)) {
        console.error(`❌ Finals path does not exist: ${finalsPath}`);
      } else {
        console.log(`✓ Finals path exists`);
        const finalsContents = fs.readdirSync(finalsPath);
        console.log(`  Files in finals folder:`, finalsContents);
      }
      
      if (!fs.existsSync(rendersPath)) {
        console.error(`❌ Renders path does not exist: ${rendersPath}`);
      } else {
        console.log(`✓ Renders path exists`);
        const rendersContents = fs.readdirSync(rendersPath);
        console.log(`  Files in renders folder:`, rendersContents);
      }

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

      // Read video files - support both .mp4 and .mov formats
      const videoFiles: { [key: string]: Buffer } = {};
      const videoBasenames = [
        `${industryPrefix}_template`,
        `${industryPrefix}_template_mobile`,
      ];

      for (const basename of videoBasenames) {
        // Try .mov first, then .mp4
        let filePath = path.join(rendersPath, `${basename}.mov`);
        let filename = `${basename}.mov`;
        
        if (!fs.existsSync(filePath)) {
          filePath = path.join(rendersPath, `${basename}.mp4`);
          filename = `${basename}.mp4`;
        }

        if (fs.existsSync(filePath)) {
          videoFiles[filename] = fs.readFileSync(filePath);
          console.log(`✓ Read ${filename}`);
        } else {
          console.warn(`⚠ Missing both ${basename}.mov and ${basename}.mp4 at ${rendersPath}`);
        }
      }

      // Upload to Sanity
      console.log("\n=== Uploading to Sanity ===");
      console.log(`Mockups to upload: ${Object.keys(mockupFiles).length}`);
      console.log(`Before/After images to upload: ${Object.keys(beforeAfterFiles).length}`);
      console.log(`Videos to upload: ${Object.keys(videoFiles).length}`);
      
      await sanityService.uploadGeneratedFiles(
        presentationId,
        mockupFiles,
        beforeAfterFiles,
        videoFiles,
        industryPrefix,
        clientId
      );

      console.log("\n=== Upload Summary ===");
      console.log(`✓ Successfully uploaded ${Object.keys(mockupFiles).length} mockup images`);
      console.log(`✓ Successfully uploaded ${Object.keys(beforeAfterFiles).length} before/after images`);
      console.log(`✓ Successfully uploaded ${Object.keys(videoFiles).length} video files`);

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
