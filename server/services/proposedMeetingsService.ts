import fs from "fs";
import path from "path";

interface ProposedMeetingEntry {
  notionPageId: string;
  companyName: string;
  meetingTimes: string[]; // ISO datetime strings
}

export class ProposedMeetingsService {
  private filePath: string;
  private persistentPath: string;

  constructor() {
    // Project root (for local development)
    this.filePath = path.join(process.cwd(), "proposed-meetings.json");

    // Persistent disk (for production on Render)
    this.persistentPath = path.join(
      "/opt/render/project/src",
      "proposed-meetings.json"
    );
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
   * Read all proposed meetings
   */
  private readMeetings(): ProposedMeetingEntry[] {
    const activePath = this.getActivePath();
    console.log(`📁 Using storage: ${activePath}`);

    try {
      if (fs.existsSync(activePath)) {
        const data = fs.readFileSync(activePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to read proposed meetings:", error);
    }

    return [];
  }

  /**
   * Write proposed meetings to disk
   */
  private writeMeetings(meetings: ProposedMeetingEntry[]): void {
    const activePath = this.getActivePath();

    try {
      fs.writeFileSync(activePath, JSON.stringify(meetings, null, 2), "utf-8");
      console.log(`✅ Saved ${meetings.length} proposed meeting entries`);
    } catch (error) {
      console.error("Failed to write proposed meetings:", error);
      throw error;
    }
  }

  /**
   * Get all taken meeting times (flat array of ISO strings)
   */
  getTakenTimes(): string[] {
    const meetings = this.readMeetings();
    const allTimes: string[] = [];

    meetings.forEach((entry) => {
      allTimes.push(...entry.meetingTimes);
    });

    return allTimes;
  }

  /**
   * Add proposed times for an entry
   */
  addProposedTimes(
    notionPageId: string,
    companyName: string,
    meetingTimes: string[]
  ): void {
    const meetings = this.readMeetings();

    // Remove existing entry if it exists
    const filtered = meetings.filter((m) => m.notionPageId !== notionPageId);

    // Add new entry
    filtered.push({
      notionPageId,
      companyName,
      meetingTimes,
    });

    this.writeMeetings(filtered);
  }

  /**
   * Remove proposed times for an entry
   */
  removeProposedTimes(notionPageId: string): void {
    const meetings = this.readMeetings();
    const filtered = meetings.filter((m) => m.notionPageId !== notionPageId);

    this.writeMeetings(filtered);
    console.log(`🗑️  Removed proposed times for entry: ${notionPageId}`);
  }

  /**
   * Update proposed times for an entry
   */
  updateProposedTimes(notionPageId: string, meetingTimes: string[]): void {
    const meetings = this.readMeetings();
    const entry = meetings.find((m) => m.notionPageId === notionPageId);

    if (entry) {
      entry.meetingTimes = meetingTimes;
      this.writeMeetings(meetings);
      console.log(`✅ Updated proposed times for entry: ${notionPageId}`);
    }
  }

  /**
   * Get all proposed meeting entries (for debugging)
   */
  getAllEntries(): ProposedMeetingEntry[] {
    return this.readMeetings();
  }
}
