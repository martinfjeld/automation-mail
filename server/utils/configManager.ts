import fs from "fs";
import path from "path";

interface EnvConfig {
  OPENAI_API_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
  SCRAPING_API_KEY?: string;
}

class ConfigManager {
  private envPath: string;

  constructor() {
    this.envPath = path.join(__dirname, "../../.env");
  }

  private loadConfig(): EnvConfig {
    return {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      NOTION_TOKEN: process.env.NOTION_TOKEN,
      NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
      SCRAPING_API_KEY: process.env.SCRAPING_API_KEY,
    };
  }

  getMissingKeys(): string[] {
    const config = this.loadConfig();
    const required = ["OPENAI_API_KEY", "NOTION_TOKEN", "NOTION_DATABASE_ID"];
    return required.filter((key) => !config[key as keyof EnvConfig]);
  }

  getConfig(): EnvConfig {
    return this.loadConfig();
  }

  hasKey(key: keyof EnvConfig): boolean {
    const config = this.loadConfig();
    return !!config[key];
  }

  async updateKeys(keys: Partial<EnvConfig>): Promise<void> {
    try {
      // Read existing .env file
      let envContent = "";
      if (fs.existsSync(this.envPath)) {
        envContent = fs.readFileSync(this.envPath, "utf-8");
      }

      // Update keys
      Object.entries(keys).forEach(([key, value]) => {
        if (value) {
          const regex = new RegExp(`^${key}=.*$`, "m");
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
          } else {
            envContent += `\n${key}=${value}`;
          }
          // Update process.env
          process.env[key] = value;
        }
      });

      // Write back to file
      fs.writeFileSync(this.envPath, envContent.trim() + "\n");
    } catch (error) {
      console.error("Error updating config:", error);
      throw new Error("Failed to update configuration");
    }
  }
}

export const configManager = new ConfigManager();
