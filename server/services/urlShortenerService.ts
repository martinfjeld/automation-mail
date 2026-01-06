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
    this.storePath = path.join(process.cwd(), "short-urls.json");
    this.ensureStoreExists();
  }

  private ensureStoreExists() {
    if (!fs.existsSync(this.storePath)) {
      fs.writeFileSync(this.storePath, JSON.stringify([]));
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
}
