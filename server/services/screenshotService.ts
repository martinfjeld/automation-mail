import puppeteer from "puppeteer";

export class ScreenshotService {
  /**
   * Attempts to dismiss cookie banners by clicking common accept buttons
   */
  private async dismissCookieBanner(page: any): Promise<void> {
    try {
      // Common selectors for cookie consent buttons (accept/agree buttons)
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[id*="consent"]',
        'button[class*="consent"]',
        'button[id*="agree"]',
        'button[class*="agree"]',
        'a[id*="accept"]',
        'a[class*="accept"]',
        '[id*="cookie"] button',
        '[class*="cookie"] button',
        'button:has-text("Godta")',
        'button:has-text("Godkjenn")',
        'button:has-text("Aksepter")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'button:has-text("OK")',
        '[aria-label*="accept"]',
        '[aria-label*="consent"]',
        '[aria-label*="agree"]',
      ];

      // Try each selector
      for (const selector of cookieSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            console.log(`✅ Clicked cookie banner button: ${selector}`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            return;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // If no button found, try to hide common cookie banner containers
      await page.evaluate(() => {
        const hiddenSelectors = [
          '[id*="cookie"]',
          '[class*="cookie"]',
          '[id*="consent"]',
          '[class*="consent"]',
          '[id*="gdpr"]',
          '[class*="gdpr"]',
        ];

        hiddenSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: any) => {
            // Only hide if it looks like a banner (fixed position, high z-index)
            const style = window.getComputedStyle(el);
            if (
              style.position === "fixed" ||
              parseInt(style.zIndex) > 1000 ||
              el.offsetHeight < window.innerHeight * 0.3
            ) {
              el.style.display = "none";
            }
          });
        });
      });

      console.log("🍪 Attempted to dismiss cookie banners");
    } catch (error: any) {
      console.log("⚠️ Could not dismiss cookie banner:", error.message);
    }
  }

  async takeScreenshots(
    url: string
  ): Promise<{ desktop: string; mobile: string }> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
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
      // Wait a bit for any lazy-loaded content and cookie banners
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Dismiss cookie banner
      await this.dismissCookieBanner(page);
      // Wait a moment after dismissing
      await new Promise((resolve) => setTimeout(resolve, 500));
      const desktopScreenshot = await page.screenshot({
        encoding: "base64",
        fullPage: false,
      });

      // Mobile screenshot (131:284 aspect ratio)
      await page.setViewport({ width: 393, height: 852 }); // 131:284 ratio
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Dismiss cookie banner on mobile view too
      await this.dismissCookieBanner(page);
      await new Promise((resolve) => setTimeout(resolve, 500));
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
