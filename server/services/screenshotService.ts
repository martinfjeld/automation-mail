import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export class ScreenshotService {
  /**
   * Find the Chrome executable path on the system
   */
  private async findChromeExecutable(): Promise<string> {
    // In production (Render), use @sparticuz/chromium
    if (process.env.NODE_ENV === "production") {
      console.log("🚀 Using @sparticuz/chromium for production");
      return await chromium.executablePath();
    }

    // Common Chrome paths for local development
    const chromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].filter(Boolean) as string[];

    console.log("🔍 Searching for Chrome executable locally...");

    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        console.log(`✅ Found Chrome at: ${chromePath}`);
        return chromePath;
      }
    }

    throw new Error("Chrome executable not found");
  }

  /**
   * Try to dismiss cookie banners and consent dialogs
   */
  private async handleCookieBanners(page: any): Promise<void> {
    try {
      console.log("🍪 Attempting to handle cookie banners...");

      // Strategy 1: Wait for common cookie banner containers to appear
      try {
        await page.waitForSelector(
          '[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"], [role="dialog"], [aria-label*="cookie" i], [aria-label*="samtykke" i]',
          { timeout: 3000, visible: true }
        );
        console.log("✅ Cookie banner detected");
      } catch (e) {
        console.log("ℹ️ No cookie banner container detected");
      }

      // Strategy 2: Click accept buttons - comprehensive list
      const acceptSelectors = [
        // Norwegian
        'button:has-text("Godta alle")',
        'button:has-text("Godta")',
        'button:has-text("Aksepter alle")',
        'button:has-text("Aksepter")',
        'button:has-text("Jeg godtar")',
        'button:has-text("OK")',
        'button:has-text("Samtykke")',
        'a:has-text("Godta")',
        'a:has-text("Aksepter")',

        // English
        'button:has-text("Accept all")',
        'button:has-text("Accept All")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("I accept")',
        'button:has-text("Allow all")',
        'button:has-text("OK")',
        'a:has-text("Accept")',

        // ID patterns
        '[id*="cookie-accept" i]',
        '[id*="accept-cookie" i]',
        '[id*="acceptCookie" i]',
        '[id*="consent-accept" i]',
        '[id*="accept-consent" i]',
        '[id*="cookie-agree" i]',
        '[id*="acceptAll" i]',
        '[id="onetrust-accept-btn-handler"]',
        '[id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"]',

        // Class patterns
        '[class*="cookie-accept" i]',
        '[class*="accept-cookie" i]',
        '[class*="acceptCookie" i]',
        '[class*="consent-accept" i]',
        '[class*="accept-consent" i]',
        '[class*="cookie-agree" i]',
        '[class*="acceptAll" i]',
        '[class*="accept-all" i]',

        // ARIA labels
        '[aria-label*="Accept" i]',
        '[aria-label*="Godta" i]',
        '[aria-label*="Aksepter" i]',
        '[aria-label*="Agree" i]',

        // Common frameworks
        '.cookie-consent button[type="submit"]',
        '.cookie-banner button[type="submit"]',
        "#cookie-banner button",
        ".cookie-notice button",
        ".gdpr-button",
        ".cookie-policy-button",
      ];

      for (const selector of acceptSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isIntersectingViewport();
            if (isVisible) {
              await element.click();
              console.log(`✅ Clicked cookie accept button: ${selector}`);
              await new Promise((resolve) => setTimeout(resolve, 1500));
              return;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Strategy 3: XPath for flexible text matching
      const xpathQueries = [
        "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ', 'abcdefghijklmnopqrstuvwxyzæøå'), 'godta')]",
        "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]",
        "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ', 'abcdefghijklmnopqrstuvwxyzæøå'), 'aksepter')]",
        "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'agree')]",
        "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ', 'abcdefghijklmnopqrstuvwxyzæøå'), 'godta')]",
        "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]",
      ];

      for (const xpath of xpathQueries) {
        try {
          const buttons = await page.$x(xpath);
          if (buttons.length > 0) {
            // Click the first visible button
            for (const button of buttons) {
              const isVisible = await button.isIntersectingViewport();
              if (isVisible) {
                await button.click();
                console.log(`✅ Clicked cookie button via XPath`);
                await new Promise((resolve) => setTimeout(resolve, 1500));
                return;
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // Strategy 4: Try to close modal dialogs with X button
      const closeSelectors = [
        '[aria-label*="Close" i]',
        '[aria-label*="Lukk" i]',
        "button.close",
        'button[title*="Close" i]',
        '[class*="close" i][class*="button" i]',
      ];

      for (const selector of closeSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const isVisible = await element.isIntersectingViewport();
            if (isVisible) {
              // Check if this close button is within a cookie banner
              const isInCookieBanner = await element.evaluate((el: any) => {
                let current = el.parentElement;
                let depth = 0;
                while (current && depth < 10) {
                  const classes = (current.className || "").toLowerCase();
                  const id = (current.id || "").toLowerCase();
                  if (
                    classes.includes("cookie") ||
                    classes.includes("consent") ||
                    id.includes("cookie") ||
                    id.includes("consent")
                  ) {
                    return true;
                  }
                  current = current.parentElement;
                  depth++;
                }
                return false;
              });

              if (isInCookieBanner) {
                await element.click();
                console.log(`✅ Closed cookie dialog via close button`);
                await new Promise((resolve) => setTimeout(resolve, 1500));
                return;
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }

      console.log("ℹ️ No cookie banner found or could not be dismissed");
    } catch (error: any) {
      console.log("ℹ️ Cookie banner handling completed (no action needed)");
    }
  }

  async takeScreenshots(
    url: string
  ): Promise<{ desktop: string; mobile: string }> {
    let browser;
    try {
      const executablePath = await this.findChromeExecutable();
      console.log(`🚀 Launching browser with executable: ${executablePath}`);

      // Get recommended args for serverless environments in production
      const args =
        process.env.NODE_ENV === "production"
          ? chromium.args
          : [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--disable-gpu",
            ];

      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args,
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
