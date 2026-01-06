import { Request, Response } from "express";
import { spawn } from "child_process";
import progressController from "./progressController";

class AutomationController {
  async runAutomation(req: Request, res: Response): Promise<void> {
    try {
      const { industry, text1, text2, address, city, clientId } = req.body;

      if (!industry || !text1 || !text2) {
        res.status(400).json({
          success: false,
          error: "Industry, text1, and text2 are required",
        });
        return;
      }

      // Validate industry
      const validIndustries = ["Helse", "Advokat", "Bygg"];
      if (!validIndustries.includes(industry)) {
        res.status(400).json({
          success: false,
          error: "Industry must be Helse, Advokat, or Bygg",
        });
        return;
      }

      console.log("\n=== Running Automation ===");
      console.log("Industry:", industry);
      console.log("Text1:", text1);
      console.log("Text2:", text2);
      console.log("Address:", address || "");
      console.log("City:", city || "");

      if (clientId) {
        progressController.sendProgress(clientId, "Starting automation...");
      }

      const pythonProcess = spawn("python3", [
        "/Users/martinfjeld/Desktop/Generater/run_automation.py",
      ]);

      let output = "";
      let errorOutput = "";

      // Handle stdout
      pythonProcess.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
        console.log(text);

        // Send progress to client
        if (clientId) {
          const cleanText = text.trim();
          if (cleanText) {
            progressController.sendProgress(clientId, cleanText);
          }
        }

        // Respond to prompts
        if (text.includes("Velg (1/2/3):")) {
          const choice =
            industry === "Helse" ? "1" : industry === "Advokat" ? "2" : "3";
          pythonProcess.stdin.write(choice + "\n");
          console.log(`Sent choice: ${choice}`);
        } else if (text.includes('Advokatfirmaet":')) {
          pythonProcess.stdin.write(text1 + "\n");
          console.log(`Sent text1: ${text1}`);
        } else if (text.includes('Øverbø Gjertz":')) {
          pythonProcess.stdin.write(text2 + "\n");
          console.log(`Sent text2: ${text2}`);
        } else if (
          text.includes('for lag "Adresse"') ||
          text.toLowerCase().includes("skriv inn adresse")
        ) {
          const addr = (address || "").toString();
          pythonProcess.stdin.write(addr + "\n");
          console.log(`Sent address: ${addr}`);
        } else if (
          text.includes('for lag "Based"') ||
          text.toLowerCase().includes("skriv inn based") ||
          text.toLowerCase().includes("skriv inn by") ||
          text.toLowerCase().includes("skriv inn city")
        ) {
          const c = (city || "").toString();
          pythonProcess.stdin.write(c + "\n");
          console.log(`Sent city: ${c}`);
        }
      });

      // Handle stderr
      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });

      // Handle completion
      pythonProcess.on("close", (code) => {
        if (code === 0) {
          const industryFolder =
            industry === "Helse"
              ? "health_files"
              : industry === "Advokat"
              ? "lawyer_files"
              : "construction_files";

          res.json({
            success: true,
            output: output,
            finalsPath: `/Users/martinfjeld/Desktop/Generater/${industryFolder}/finals`,
            rendersPath: "/Users/martinfjeld/Desktop/Generater/output/renders",
          });
        } else {
          res.status(500).json({
            success: false,
            error: errorOutput || `Process exited with code ${code}`,
            code: code,
          });
        }
      });

      pythonProcess.on("error", (err) => {
        res.status(500).json({
          success: false,
          error: err.message,
        });
      });
    } catch (error: any) {
      console.error("Automation error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to run automation",
      });
    }
  }
}

export const automationController = new AutomationController();
