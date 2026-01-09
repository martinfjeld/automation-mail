import fs from "fs";
import path from "path";

interface BanListEntry {
  proffUrl: string;
  companyName: string;
  bannedAt: string;
}

interface BanListData {
  entries: BanListEntry[];
}

export class BanListService {
  private filePath: string;
  private persistentPath: string;

  constructor() {
    // Project root (for local development)
    this.filePath = path.join(process.cwd(), "ban-list.json");

    // Persistent disk (for production on Render)
    this.persistentPath = path.join("/opt/render/project/src", "ban-list.json");
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
   * Read ban list from disk
   */
  private readBanList(): BanListData {
    const activePath = this.getActivePath();

    if (!fs.existsSync(activePath)) {
      const initialData: BanListData = { entries: [] };
      this.writeBanList(initialData);
      return initialData;
    }

    try {
      const fileContent = fs.readFileSync(activePath, "utf-8");
      return JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading ban list:", error);
      return { entries: [] };
    }
  }

  /**
   * Write ban list to disk
   */
  private writeBanList(data: BanListData): void {
    const activePath = this.getActivePath();
    fs.writeFileSync(activePath, JSON.stringify(data, null, 2));
  }

  /**
   * Add a company to the ban list
   */
  addToBanList(proffUrl: string, companyName: string): void {
    const data = this.readBanList();

    // Check if already banned
    const exists = data.entries.some((entry) => entry.proffUrl === proffUrl);
    if (exists) {
      console.log(`⚠️ Company already in ban list: ${companyName}`);
      return;
    }

    // Add new entry
    data.entries.push({
      proffUrl,
      companyName,
      bannedAt: new Date().toISOString(),
    });

    this.writeBanList(data);
    console.log(`🚫 Added to ban list: ${companyName} (${proffUrl})`);
  }

  /**
   * Check if a proffUrl is banned
   */
  isBanned(proffUrl: string): boolean {
    const data = this.readBanList();
    return data.entries.some((entry) => entry.proffUrl === proffUrl);
  }

  /**
   * Get all banned entries
   */
  getAllEntries(): BanListEntry[] {
    const data = this.readBanList();
    return data.entries;
  }

  /**
   * Remove a company from the ban list (if user wants to unban)
   */
  removeFromBanList(proffUrl: string): void {
    const data = this.readBanList();
    data.entries = data.entries.filter((entry) => entry.proffUrl !== proffUrl);
    this.writeBanList(data);
    console.log(`✅ Removed from ban list: ${proffUrl}`);
  }

  /**
   * Clear all banned entries
   */
  clearBanList(): void {
    this.writeBanList({ entries: [] });
    console.log("🗑️ Ban list cleared");
  }
}
