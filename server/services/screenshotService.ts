import puppeteer from "puppeteer";

export class ScreenshotService {
  async takeScreenshots(
    url: string
  ): Promise<{ desktop: string; mobile: string }> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Desktop screenshot (16:10 aspect ratio)
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Wait a bit for any lazy-loaded content
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const desktopScreenshot = await page.screenshot({
        encoding: "base64",
        fullPage: false,
      });

      // Mobile screenshot (131:284 aspect ratio)
      await page.setViewport({ width: 393, height: 852 }); // 131:284 ratio
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mobileScreenshot = await page.screenshot({
        encoding: "base64",
        fullPage: false,
      });

      await browser.close();

      return {
        desktop: desktopScreenshot as string,
        mobile: mobileScreenshot as string,
      };
    } catch (error: any) {
      console.error("Screenshot failed:", error.message);
      if (browser) {
        await browser.close();
      }
      return { desktop: "", mobile: "" };
    }
  }
}
