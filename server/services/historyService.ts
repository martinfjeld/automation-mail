import * as fs from "fs";
import * as path from "path";

export interface HistoryEntry {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  website: string;
  address?: string;
  city?: string;
  service: string;
  notionPageId: string;
  sanityPresentationId?: string;
  presentationUrl?: string;
  emailContent?: string;
  industry?: string;
  automationIndustry?: string;
  automationText1?: string;
  automationText2?: string;
  logoUrl?: string;
  imagesGenerated?: boolean;
  emailSent?: boolean;
  leadStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export class HistoryService {
  private historyFilePath: string;

  constructor() {
    // Store history.json in the project root
    this.historyFilePath = path.join(process.cwd(), "history.json");
    this.ensureHistoryFile();
  }

  private ensureHistoryFile(): void {
    if (!fs.existsSync(this.historyFilePath)) {
      fs.writeFileSync(this.historyFilePath, JSON.stringify([], null, 2));
      console.log("✅ Created history.json file");
    }
  }

  private readHistory(): HistoryEntry[] {
    try {
      const data = fs.readFileSync(this.historyFilePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading history file:", error);
      return [];
    }
  }

  private writeHistory(history: HistoryEntry[]): void {
    try {
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(history, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Error writing history file:", error);
      throw new Error("Failed to write history file");
    }
  }

  /**
   * Add a new entry to history
   */
  addEntry(entry: Omit<HistoryEntry, "createdAt" | "updatedAt">): HistoryEntry {
    const history = this.readHistory();
    const now = new Date().toISOString();

    const newEntry: HistoryEntry = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };

    history.unshift(newEntry); // Add to beginning
    this.writeHistory(history);

    console.log(`✅ Added entry to history: ${entry.companyName}`);
    return newEntry;
  }

  /**
   * Update an existing entry in history
   */
  updateEntry(
    id: string,
    updates: Partial<Omit<HistoryEntry, "id" | "createdAt" | "updatedAt">>
  ): HistoryEntry | null {
    const history = this.readHistory();
    const index = history.findIndex((entry) => entry.id === id);

    if (index === -1) {
      console.warn(`⚠️ Entry not found in history: ${id}`);
      return null;
    }

    const updatedEntry: HistoryEntry = {
      ...history[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    history[index] = updatedEntry;
    this.writeHistory(history);

    console.log(`✅ Updated entry in history: ${updatedEntry.companyName}`);
    return updatedEntry;
  }

  /**
   * Delete an entry from history
   */
  deleteEntry(id: string): boolean {
    const history = this.readHistory();
    const initialLength = history.length;
    const filteredHistory = history.filter((entry) => entry.id !== id);

    if (filteredHistory.length === initialLength) {
      console.warn(`⚠️ Entry not found in history: ${id}`);
      return false;
    }

    this.writeHistory(filteredHistory);
    console.log(`✅ Deleted entry from history: ${id}`);
    return true;
  }

  /**
   * Get all history entries
   */
  getAllEntries(): HistoryEntry[] {
    return this.readHistory();
  }

  /**
   * Get a specific entry by ID
   */
  getEntryById(id: string): HistoryEntry | null {
    const history = this.readHistory();
    return history.find((entry) => entry.id === id) || null;
  }

  /**
   * Get entry by Notion page ID
   */
  getEntryByNotionPageId(notionPageId: string): HistoryEntry | null {
    const history = this.readHistory();
    return history.find((entry) => entry.notionPageId === notionPageId) || null;
  }
}
