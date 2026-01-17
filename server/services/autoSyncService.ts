import https from "https";
import { HistoryService } from "./historyService";

export class AutoSyncService {
  private static instance: AutoSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly PRODUCTION_URL = "https://automation-mail-zk8t.onrender.com";
  private readonly SYNC_INTERVAL_MS = 30000; // 30 seconds
  private isReady = false;

  private constructor() {}

  public static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }
    return AutoSyncService.instance;
  }

  /**
   * Start automatic syncing with production server
   */
  public startAutoSync(): void {
    if (this.syncInterval) {
      console.log("⚠️  Auto-sync already running");
      return;
    }

    console.log("🔄 Starting auto-sync with production (every 30s)");

    // Initial sync after a short delay to let server start up
    setTimeout(() => {
      this.isReady = true;
      this.syncWithProduction();
    }, 5000);

    // Set up interval for regular syncing
    this.syncInterval = setInterval(() => {
      if (this.isReady) {
        this.syncWithProduction();
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop automatic syncing
   */
  public stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("⏹️  Auto-sync stopped");
    }
  }

  /**
   * Manually trigger a sync with production
   */
  public async syncWithProduction(): Promise<boolean> {
    try {
      console.log("🔄 Syncing with production...");

      const productionData = await this.fetchProductionHistory();

      if (!productionData || !Array.isArray(productionData)) {
        console.log("❌ Invalid production data received");
        return false;
      }

      // Update local history with production data
      const historyService = new HistoryService();
      const localEntries = historyService.getAllEntries();

      // Check if there are any differences (basic comparison by count and last updated)
      const hasUpdates = this.hasUpdates(localEntries, productionData);

      if (hasUpdates) {
        console.log(
          `📥 Updating local history with ${productionData.length} entries from production`
        );

        // Replace local history with production data
        for (const entry of productionData) {
          historyService.updateEntry(entry.id, entry);
        }

        console.log("✅ Local history synchronized with production");
        return true;
      } else {
        console.log("📊 Local history already up to date");
        return false;
      }
    } catch (error) {
      console.error("❌ Auto-sync failed:", error);
      return false;
    }
  }

  /**
   * Fetch history data from production server
   */
  private fetchProductionHistory(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "automation-mail-zk8t.onrender.com",
        path: "/api/history",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode === 200) {
              const result = JSON.parse(body);
              const entries = result.data || result.entries || result;
              resolve(entries);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
  }

  /**
   * Check if production data has updates compared to local data
   */
  private hasUpdates(localEntries: any[], productionEntries: any[]): boolean {
    if (localEntries.length !== productionEntries.length) {
      return true;
    }

    // Check if any entry has a newer updatedAt timestamp
    for (const prodEntry of productionEntries) {
      const localEntry = localEntries.find((e) => e.id === prodEntry.id);
      if (!localEntry) {
        return true; // New entry
      }

      // Check for møtedato field differences (main booking indicator)
      if (prodEntry.møtedato !== localEntry.møtedato) {
        return true;
      }

      // Check for leadStatus differences
      if (prodEntry.leadStatus !== localEntry.leadStatus) {
        return true;
      }

      // Check updatedAt timestamp
      if (
        prodEntry.updatedAt &&
        localEntry.updatedAt &&
        new Date(prodEntry.updatedAt) > new Date(localEntry.updatedAt)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): {
    isRunning: boolean;
    isReady: boolean;
    intervalMs: number;
  } {
    return {
      isRunning: this.syncInterval !== null,
      isReady: this.isReady,
      intervalMs: this.SYNC_INTERVAL_MS,
    };
  }
}
