import crypto from "crypto";
import fs from "fs";
import path from "path";

interface ShortUrl {
  code: string;
  fullUrl: string;
  createdAt: string;
}

export class UrlShortenerService {
  private storePath: string;

  constructor() {
    // Use persistent storage if available, otherwise project root
    const persistentPath = process.env.PERSISTENT_STORAGE_PATH;
    if (persistentPath) {
      this.storePath = path.join(persistentPath, "short-urls.json");
      console.log(`📁 Using persistent storage: ${this.storePath}`);
    } else {
      this.storePath = path.join(process.cwd(), "short-urls.json");
      console.log(`📁 Using project root storage: ${this.storePath}`);
    }
    this.ensureStoreExists();
  }

  private ensureStoreExists() {
    if (!fs.existsSync(this.storePath)) {
      fs.writeFileSync(this.storePath, JSON.stringify([]));
      console.log("✅ Created short-urls.json file");
    }
  }

  private readStore(): ShortUrl[] {
    try {
      const data = fs.readFileSync(this.storePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeStore(urls: ShortUrl[]) {
    fs.writeFileSync(this.storePath, JSON.stringify(urls, null, 2));
  }

  /**
   * Generate a short 6-character code
   */
  private generateCode(): string {
    return crypto.randomBytes(3).toString("hex");
  }

  /**
   * Create a short URL
   */
  createShortUrl(fullUrl: string): string {
    const urls = this.readStore();

    // Check if URL already exists
    const existing = urls.find((u) => u.fullUrl === fullUrl);
    if (existing) {
      return existing.code;
    }

    // Generate new code
    let code = this.generateCode();

    // Ensure uniqueness
    while (urls.some((u) => u.code === code)) {
      code = this.generateCode();
    }

    // Save
    urls.push({
      code,
      fullUrl,
      createdAt: new Date().toISOString(),
    });

    this.writeStore(urls);
    return code;
  }

  /**
   * Get full URL from short code
   */
  getFullUrl(code: string): string | null {
    const urls = this.readStore();
    const entry = urls.find((u) => u.code === code);
    return entry ? entry.fullUrl : null;
  }

  /**
   * Get all URLs
   */
  getAllUrls(): ShortUrl[] {
    return this.readStore();
  }

  /**
   * Clean up old URLs (older than 30 days)
   */
  cleanup() {
    const urls = this.readStore();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const filtered = urls.filter((u) => {
      const created = new Date(u.createdAt).getTime();
      return created > thirtyDaysAgo;
    });

    this.writeStore(filtered);
  }

  /**
   * Clear all URLs
   */
  clearAll(): void {
    this.writeStore([]);
    console.log("🗑️  Cleared all short URLs");
  }

  /**
   * Delete specific short URL codes
   */
  deleteCodes(codes: string[]): void {
    if (!codes || codes.length === 0) return;

    const urls = this.readStore();
    const filtered = urls.filter((u) => !codes.includes(u.code));
    this.writeStore(filtered);
    console.log(`🗑️  Deleted ${urls.length - filtered.length} short URL(s)`);
  }
}
