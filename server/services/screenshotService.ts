import puppeteer from "puppeteer";

export class ScreenshotService {
  /**
   * Try to dismiss cookie banners and consent dialogs
   */
  private async handleCookieBanners(page: any): Promise<void> {
    try {
      // Common cookie banner button selectors (Norwegian and English)
      const cookieSelectors = [
        // Text-based selectors (most reliable)
        'button:has-text("Godta alle")',
        'button:has-text("Godta")',
        'button:has-text("Accept")',
        'button:has-text("Accepter")',
        'button:has-text("OK")',
        'button:has-text("Jeg godtar")',
        'button:has-text("I accept")',
        'a:has-text("Godta")',
        'a:has-text("Accept")',
        // Common class/id patterns
        '[id*="cookie-accept"]',
        '[id*="accept-cookie"]',
        '[class*="cookie-accept"]',
        '[class*="accept-cookie"]',
        '[id*="consent-accept"]',
        '[class*="consent-accept"]',
        '.cookie-consent button',
        '#cookie-banner button',
        '[aria-label*="Accept"]',
        '[aria-label*="Godta"]',
      ];

      for (const selector of cookieSelectors) {
        try {
          // Check if element exists and is visible
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isIntersectingViewport();
            if (isVisible) {
              await element.click();
              console.log(`✅ Clicked cookie banner: ${selector}`);
              // Wait for banner to disappear
              await new Promise((resolve) => setTimeout(resolve, 1000));
              return;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Try XPath for text matching (fallback)
      try {
        const buttons = await page.$x(
          "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ', 'abcdefghijklmnopqrstuvwxyzæøå'), 'godta') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]"
        );
        if (buttons.length > 0) {
          await buttons[0].click();
          console.log("✅ Clicked cookie banner via XPath");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (e) {
        // No cookie banner found, continue
      }
    } catch (error: any) {
      // Ignore errors - cookie banners are optional
      console.log("ℹ️ No cookie banner found or already dismissed");
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
      // Wait for initial content
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Handle cookie banners
      await this.handleCookieBanners(page);
      // Wait a bit more for any animations
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const desktopScreenshot = await page.screenshot({
        encoding: "base64",
        fullPage: false,
      });

      // Mobile screenshot (131:284 aspect ratio)
      await page.setViewport({ width: 393, height: 852 }); // 131:284 ratio
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Handle cookie banners on mobile view
      await this.handleCookieBanners(page);
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
