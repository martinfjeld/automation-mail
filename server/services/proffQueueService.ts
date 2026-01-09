import fs from "fs";
import path from "path";
import { HistoryService } from "./historyService";
import { BanListService } from "./banListService";

interface QueueCompany {
  id: string; // unique identifier (company name + org number)
  companyName: string;
  proffUrl: string;
  organizationNumber?: string;
  industry?: string;
  employees?: string;
  revenue?: string;
}

interface ProffQueueData {
  searchUrl: string;
  queue: QueueCompany[];
  lastScrapedCompany: string;
  currentPage: number;
}

export class ProffQueueService {
  private filePath: string;
  private persistentPath: string;
  private historyService: HistoryService;
  private banListService: BanListService;

  constructor() {
    // Project root (for local development)
    this.filePath = path.join(process.cwd(), "proff-queue.json");

    // Persistent disk (for production on Render)
    this.persistentPath = path.join(
      "/opt/render/project/src",
      "proff-queue.json"
    );

    this.historyService = new HistoryService();
    this.banListService = new BanListService();
  }

  /**
   * Determine which file to use
   */
  private getActivePath(): string {
    // If persistent disk exists (production), use it
    if (fs.existsSync(path.dirname(this.persistentPath))) {
      return this.persistentPath;
    }
    // Otherwise use project root (local development)
    return this.filePath;
  }

  /**
   * Read queue data
   */
  private readQueue(): ProffQueueData {
    const activePath = this.getActivePath();
    console.log(`📁 Using Proff queue storage: ${activePath}`);

    try {
      if (fs.existsSync(activePath)) {
        const data = fs.readFileSync(activePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to read Proff queue:", error);
    }

    // Return default structure if file doesn't exist or read fails
    return {
      searchUrl:
        "https://www.proff.no/laglister?profitFrom=512&profitTo=47479000&numEmployeesFrom=10&numEmployeesTo=32524&proffIndustryCode=10158%2C16684%2C296%2C47420",
      queue: [],
      lastScrapedCompany: "",
      currentPage: 1,
    };
  }

  /**
   * Write queue data to disk
   */
  private writeQueue(data: ProffQueueData): void {
    const activePath = this.getActivePath();

    try {
      fs.writeFileSync(activePath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`✅ Saved Proff queue (${data.queue.length} companies)`);
    } catch (error) {
      console.error("Failed to write Proff queue:", error);
      throw error;
    }
  }

  /**
   * Check if company already exists in history
   */
  private isInHistory(proffUrl: string, companyName: string): boolean {
    const entries = this.historyService.getAllEntries();
    return entries.some((entry: any) => {
      // Check by proffUrl (new entries)
      if (entry.proffUrl && entry.proffUrl === proffUrl) {
        return true;
      }
      // Fallback: check by company name (old entries without proffUrl)
      // Normalize names for comparison
      const entryName = entry.companyName
        ?.toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const queueName = companyName?.toLowerCase().replace(/\s+/g, " ").trim();

      if (!entryName || !queueName) return false;

      // Check if names match exactly
      if (entryName === queueName) return true;

      // Check if one name contains the other (handles "Østheim Fornyelse" vs "ØSTHEIM BYGGFORNYELSE AS")
      // Extract first significant word (usually company name)
      const entryFirstWords = entryName.split(" ").slice(0, 2).join(" ");
      const queueFirstWords = queueName.split(" ").slice(0, 2).join(" ");

      // If first 2 words match, consider it the same company
      if (entryFirstWords.length > 3 && queueFirstWords.length > 3) {
        if (
          entryName.includes(queueFirstWords) ||
          queueName.includes(entryFirstWords)
        ) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Get current queue (filtered by history and ban list)
   */
  getQueue(): QueueCompany[] {
    const data = this.readQueue();
    // Filter out companies that have been generated (in history) OR are banned
    return data.queue.filter((company) => {
      const inHistory = this.isInHistory(company.proffUrl, company.companyName);
      const isBanned = this.banListService.isBanned(company.proffUrl);

      if (isBanned) {
        console.log(`🚫 Skipping banned company: ${company.companyName}`);
      }

      return !inHistory && !isBanned;
    });
  }

  /**
   * Get full queue data including metadata
   */
  getQueueData(): ProffQueueData {
    return this.readQueue();
  }

  /**
   * Add companies to queue (with deduplication)
   */
  addToQueue(companies: QueueCompany[]): void {
    const data = this.readQueue();

    for (const company of companies) {
      // Skip if already in queue
      if (data.queue.some((c) => c.id === company.id)) {
        console.log(`⚠️ Skipping duplicate in queue: ${company.companyName}`);
        continue;
      }

      // Skip if already in history
      if (this.isInHistory(company.proffUrl, company.companyName)) {
        console.log(`⚠️ Skipping (in history): ${company.companyName}`);
        continue;
      }

      // Skip if banned
      if (this.banListService.isBanned(company.proffUrl)) {
        console.log(`🚫 Skipping (banned): ${company.companyName}`);
        continue;
      }

      data.queue.push(company);
      console.log(`➕ Added to queue: ${company.companyName}`);
    }

    this.writeQueue(data);
  }

  /**
   * Remove company from queue (after generation)
   */
  removeFromQueue(companyId: string): void {
    const data = this.readQueue();
    const filtered = data.queue.filter((c) => c.id !== companyId);

    if (filtered.length < data.queue.length) {
      data.queue = filtered;
      this.writeQueue(data);
      console.log(`🗑️ Removed from queue: ${companyId}`);
    }
  }

  /**
   * Update progress tracking
   */
  updateProgress(lastScrapedCompany: string, currentPage: number): void {
    const data = this.readQueue();
    data.lastScrapedCompany = lastScrapedCompany;
    data.currentPage = currentPage;
    this.writeQueue(data);
  }

  /**
   * Reset queue (clear all data)
   */
  reset(): void {
    const data = this.readQueue();
    data.queue = [];
    data.lastScrapedCompany = "";
    data.currentPage = 1;
    this.writeQueue(data);
    console.log("🔄 Proff queue reset");
  }

  /**
   * Get search URL with page parameter
   */
  getSearchUrl(page: number = 1): string {
    const data = this.readQueue();
    const url = new URL(data.searchUrl);
    url.searchParams.set("page", page.toString());
    return url.toString();
  }

  /**
   * Update the search URL
   */
  updateSearchUrl(newUrl: string): void {
    const data = this.readQueue();
    data.searchUrl = newUrl;
    this.writeQueue(data);
    console.log(`🔗 Updated search URL: ${newUrl}`);
  }
}
