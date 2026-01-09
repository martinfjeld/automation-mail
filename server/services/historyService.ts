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
  proffUrl?: string; // Proff.no URL for queue filtering
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
  meetingDates?: string[]; // Array of 3 ISO date strings from meeting proposals
  bookingLinks?: string[]; // Array of 3 short URLs for booking
  møtedato?: string; // The actual booked meeting date (when customer confirms)
  bookedSlotIndex?: number; // Which slot was booked (0, 1, or 2)
  createdAt: string;
  updatedAt: string;
}

export class HistoryService {
  private historyFilePath: string;

  constructor() {
    // Use persistent storage if available (Render disk), otherwise project root
    const persistentPath = process.env.PERSISTENT_STORAGE_PATH;
    if (persistentPath) {
      this.historyFilePath = path.join(persistentPath, "history.json");
      console.log(`📁 Using persistent storage: ${this.historyFilePath}`);

      // Migration: Copy from project root to persistent disk if persistent is empty
      const projectRootPath = path.join(process.cwd(), "history.json");
      if (
        fs.existsSync(projectRootPath) &&
        !fs.existsSync(this.historyFilePath)
      ) {
        console.log(
          `🔄 Migrating history.json from project root to persistent disk...`
        );
        try {
          const data = fs.readFileSync(projectRootPath, "utf-8");
          fs.writeFileSync(this.historyFilePath, data);
          console.log(`✅ Migration complete: ${this.historyFilePath}`);
        } catch (error) {
          console.error(`❌ Migration failed:`, error);
        }
      }
    } else {
      this.historyFilePath = path.join(process.cwd(), "history.json");
      console.log(`📁 Using project root storage: ${this.historyFilePath}`);
    }
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
   * Add a complete entry to history (used for syncing from production)
   */
  addCompleteEntry(entry: HistoryEntry): HistoryEntry {
    const history = this.readHistory();

    // Check if entry already exists
    const existingIndex = history.findIndex((e) => e.id === entry.id);
    if (existingIndex !== -1) {
      console.warn(`⚠️ Entry already exists: ${entry.id}, updating instead`);
      return this.updateEntry(entry.id, entry)!;
    }

    history.unshift(entry); // Add to beginning
    this.writeHistory(history);

    console.log(`✅ Added complete entry to history: ${entry.companyName}`);
    return entry;
  }

  /**
   * Update an existing entry in history
   */
  updateEntry(
    id: string,
    updates: Partial<Omit<HistoryEntry, "id">>
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
      // Only update updatedAt if it's not provided in updates
      updatedAt: updates.updatedAt || new Date().toISOString(),
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
