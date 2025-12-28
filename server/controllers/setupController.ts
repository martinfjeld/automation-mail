import { Request, Response } from "express";
import { configManager } from "../utils/configManager";
import { OpenAIService } from "../services/openaiService";
import { NotionService } from "../services/notionService";

class SetupController {
  async checkStatus(req: Request, res: Response): Promise<void> {
    try {
      const missingKeys = configManager.getMissingKeys();
      const config = configManager.getConfig();

      res.json({
        success: true,
        isSetupComplete: missingKeys.length === 0,
        missingKeys,
        availableKeys: {
          OPENAI_API_KEY: !!config.OPENAI_API_KEY,
          NOTION_TOKEN: !!config.NOTION_TOKEN,
          NOTION_DATABASE_ID: !!config.NOTION_DATABASE_ID,
          SCRAPING_API_KEY: !!config.SCRAPING_API_KEY,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async validateAndSave(req: Request, res: Response): Promise<void> {
    try {
      const {
        OPENAI_API_KEY,
        NOTION_TOKEN,
        NOTION_DATABASE_ID,
        SCRAPING_API_KEY,
      } = req.body;

      const validationResults: Record<string, boolean> = {};
      const errors: Record<string, string> = {};

      // Validate OpenAI API Key
      if (OPENAI_API_KEY) {
        try {
          const openaiService = new OpenAIService(OPENAI_API_KEY);
          await openaiService.testConnection();
          validationResults.OPENAI_API_KEY = true;
        } catch (error: any) {
          validationResults.OPENAI_API_KEY = false;
          errors.OPENAI_API_KEY = error.message;
        }
      }

      // Validate Notion credentials
      if (NOTION_TOKEN && NOTION_DATABASE_ID) {
        try {
          const notionService = new NotionService(
            NOTION_TOKEN,
            NOTION_DATABASE_ID
          );
          await notionService.testConnection();
          validationResults.NOTION_TOKEN = true;
          validationResults.NOTION_DATABASE_ID = true;
        } catch (error: any) {
          validationResults.NOTION_TOKEN = false;
          validationResults.NOTION_DATABASE_ID = false;
          errors.NOTION = error.message;
        }
      }

      // Check if all required validations passed
      const allValid =
        validationResults.OPENAI_API_KEY &&
        validationResults.NOTION_TOKEN &&
        validationResults.NOTION_DATABASE_ID;

      if (!allValid) {
        res.status(400).json({
          success: false,
          validationResults,
          errors,
          message: "Some credentials failed validation",
        });
        return;
      }

      // Save validated keys
      await configManager.updateKeys({
        OPENAI_API_KEY,
        NOTION_TOKEN,
        NOTION_DATABASE_ID,
        ...(SCRAPING_API_KEY && { SCRAPING_API_KEY }),
      });

      res.json({
        success: true,
        message: "All credentials validated and saved successfully",
        validationResults,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const setupController = new SetupController();
