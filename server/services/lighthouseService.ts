import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  seo: number;
}

export class LighthouseService {
  /**
   * Run Lighthouse audit on a website and return scores
   */
  async auditWebsite(url: string): Promise<LighthouseScores | null> {
    let chrome;
    try {
      console.log(`\n🔦 Running Lighthouse audit on: ${url}`);

      // Launch Chrome
      chrome = await chromeLauncher.launch({
        chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
      });

      // Run Lighthouse
      const options = {
        logLevel: "error" as const,
        output: "json" as const,
        onlyCategories: ["performance", "accessibility", "seo"],
        port: chrome.port,
      };

      const runnerResult = await lighthouse(url, options);

      if (!runnerResult || !runnerResult.lhr) {
        console.error("❌ Lighthouse audit failed - no results");
        return null;
      }

      const { categories } = runnerResult.lhr;

      const scores: LighthouseScores = {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
      };

      console.log("✅ Lighthouse audit complete:");
      console.log(`  - Performance: ${scores.performance}%`);
      console.log(`  - Accessibility: ${scores.accessibility}%`);
      console.log(`  - SEO: ${scores.seo}%`);

      return scores;
    } catch (error: any) {
      console.error("❌ Lighthouse audit failed:", error.message);
      return null;
    } finally {
      if (chrome) {
        await chrome.kill();
      }
    }
  }
}
