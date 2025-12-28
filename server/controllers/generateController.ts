import { Request, Response } from "express";
import { configManager } from "../utils/configManager";
import { ScraperService } from "../services/scraperService";
import { OpenAIService } from "../services/openaiService";
import { NotionService } from "../services/notionService";
import { ScreenshotService } from "../services/screenshotService";
import { SanityService } from "../services/sanityService";

// Normalize company name: proper capitalization and remove AS suffix, prefixes, and countries
function normalizeCompanyName(name: string): string {
  if (!name) return name;

  let normalized = name.trim();

  // Remove generic industry descriptors from ANYWHERE in the string
  // Legal
  normalized = normalized.replace(/\s*Advokatfirmaet\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Advokatfirma\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Advokat\s*/gi, " ").trim();

  // Construction (only generic terms, not specific like "Tak")
  normalized = normalized.replace(/\s*Entreprenør\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Bygg\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Byggmester\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Anlegg\s*/gi, " ").trim();

  // Health/Fitness (generic descriptors)
  normalized = normalized.replace(/\s*Aktivitet\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Helse\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Health\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Fitness\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Trening\s*/gi, " ").trim();

  // Generic business words
  normalized = normalized.replace(/\s*Service\s*/gi, " ").trim();
  normalized = normalized.replace(/\s*Tjenester\s*/gi, " ").trim();

  // Remove common business prefixes (case insensitive)
  normalized = normalized.replace(/^(The)\s+/i, "").trim();

  // Remove AS/ASA/DA/ANS and other business form suffixes (case insensitive)
  normalized = normalized
    .replace(/\s+(AS|ASA|DA|ANS|BA|SA|NUF|KF|AL)$/i, "")
    .trim();

  // Remove country names (case insensitive)
  normalized = normalized
    .replace(/\s+(Norge|Norway|Sweden|Sverige|Denmark|Danmark)$/i, "")
    .trim();

  // Remove "og" (and) if it appears
  normalized = normalized.replace(/\s+og\s+/gi, " ").trim();

  // Clean up any double spaces left from removals
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Convert to proper case (capitalize first letter of each word)
  normalized = normalized
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  console.log(`📝 Normalized company name: "${name}" → "${normalized}"`);
  return normalized;
}

class GenerateController {
  async generate(req: Request, res: Response): Promise<void> {
    // Check if client wants SSE
    const useSSE = req.headers.accept?.includes("text/event-stream");

    if (useSSE) {
      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
    }

    const sendProgress = (step: string) => {
      if (useSSE) {
        res.write(`data: ${JSON.stringify({ step })}\n\n`);
      }
    };

    try {
      const { proffUrl, service } = req.body;

      // Validate input
      if (!proffUrl || !service) {
        if (useSSE) {
          res.write(
            `data: ${JSON.stringify({
              error: "Missing required fields: proffUrl and service",
            })}\n\n`
          );
          res.end();
        } else {
          res.status(400).json({
            success: false,
            error: "Missing required fields: proffUrl and service",
          });
        }
        return;
      }

      // Validate service type
      const validServices = ["Video", "Images", "Web", "Branding"];
      if (!validServices.includes(service)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid service type. Must be: Video, Images, Web, or Branding",
        });
        return;
      }

      // Initialize services from .env
      const config = configManager.getConfig();

      // Check if keys are present in .env
      if (
        !config.OPENAI_API_KEY ||
        !config.NOTION_TOKEN ||
        !config.NOTION_DATABASE_ID
      ) {
        res.status(500).json({
          success: false,
          error:
            "Missing API keys. Please configure your .env file with OPENAI_API_KEY, NOTION_TOKEN, and NOTION_DATABASE_ID",
        });
        return;
      }

      const scraperService = new ScraperService();
      const openaiService = new OpenAIService(config.OPENAI_API_KEY);
      const notionService = new NotionService(
        config.NOTION_TOKEN,
        config.NOTION_DATABASE_ID
      );

      // Initialize Sanity service if credentials are available
      let sanityService: SanityService | null = null;
      console.log("\n🔍 Checking Sanity credentials...");
      console.log("  - SANITY_PROJECT_ID:", config.SANITY_PROJECT_ID || "MISSING");
      console.log("  - SANITY_DATASET:", config.SANITY_DATASET || "MISSING");
      console.log("  - SANITY_TOKEN:", config.SANITY_TOKEN ? `${config.SANITY_TOKEN.substring(0, 10)}...` : "MISSING");
      
      if (
        config.SANITY_PROJECT_ID &&
        config.SANITY_DATASET &&
        config.SANITY_TOKEN
      ) {
        console.log("✅ All Sanity credentials present, initializing service...");
        sanityService = new SanityService(
          config.SANITY_PROJECT_ID,
          config.SANITY_DATASET,
          config.SANITY_TOKEN
        );
      } else {
        console.log(
          "⚠️ Sanity credentials not found - skipping Sanity integration"
        );
      }
      const screenshotService = new ScreenshotService();

      // PHASE 1: Traditional HTML Scraping from Proff.no
      console.log("=== PHASE 1: Traditional Scraping ===");
      sendProgress("Fetching company data...");
      const companyInfo = await scraperService.getCompanyInfo(proffUrl);

      console.log("Scraped from Proff.no HTML:");
      console.log("- Company Name:", companyInfo.companyName);
      console.log("- Contact Person:", companyInfo.styretsleder);
      console.log("- Website:", companyInfo.website || "NOT FOUND");

      // Validate Proff website (Proff pages sometimes contain unrelated external links).
      if (companyInfo.website) {
        const verifiedFromProff = await scraperService.validateCompanyWebsite(
          companyInfo.website,
          companyInfo.companyName
        );

        if (!verifiedFromProff) {
          console.warn(
            "⚠️ Proff website link failed verification; will try web search fallback"
          );
          companyInfo.website = "";
        } else if (verifiedFromProff !== companyInfo.website) {
          companyInfo.website = verifiedFromProff;
        }
      }

      // WEBSITE FALLBACK: Verified web search (never guess URLs)
      if (!companyInfo.website) {
        console.log("\n=== WEBSITE FALLBACK: Verified Web Search ===");
        try {
          const candidates = await openaiService.searchCompanyWebsiteCandidates(
            companyInfo.companyName,
            companyInfo.styretsleder
          );

          console.log(
            `Website candidates from web search: ${candidates.length}`
          );

          for (const candidate of candidates) {
            const verified = await scraperService.validateCompanyWebsite(
              candidate.url,
              companyInfo.companyName
            );

            if (verified) {
              companyInfo.website = verified;
              console.log("✅ Verified company website:", verified);
              break;
            } else {
              console.log("❌ Rejected candidate URL:", candidate.url);
            }
          }

          if (!companyInfo.website) {
            console.warn("⚠️ No verified website found from web search");
          }
        } catch (e) {
          console.warn("⚠️ Website fallback search failed:", e);
        }
      }

      // PHASE 2: AI-Powered Web Search Enrichment using gpt-4o-search-preview
      console.log("\n=== PHASE 2: AI Web Search Enrichment ===");
      sendProgress("Analyzing information...");
      let finalContactPerson = companyInfo.styretsleder;
      let finalWebsite = companyInfo.website;
      let finalEmail = companyInfo.contactEmail;
      let finalPhone = companyInfo.contactPhone;
      let enrichedCompanyName = companyInfo.companyName;
      let enrichedContactPerson = companyInfo.styretsleder;
      let contactPersonPageUrl = "";
      let industry = "";

      try {
        const aiEnriched = await openaiService.enrichCompanyInfoWithWebSearch(
          proffUrl,
          companyInfo.companyName,
          companyInfo.styretsleder,
          companyInfo.website
        );

        console.log("AI enrichment results:");
        console.log("- Company:", aiEnriched.selskap);
        console.log("- Name:", aiEnriched.navn);
        console.log("- Email:", aiEnriched.kundeEpost);
        console.log("- Phone:", aiEnriched.telefon);

        // CRITICAL: Website comes ONLY from Proff.no HTML scraping (never from AI)
        finalWebsite = companyInfo.website;

        // For other fields, AI data takes priority, scraped data as fallback
        // Normalize company names to remove prefixes/suffixes
        enrichedCompanyName = normalizeCompanyName(
          aiEnriched.selskap || companyInfo.companyName
        );
        enrichedContactPerson = aiEnriched.navn || companyInfo.styretsleder;
        finalContactPerson = aiEnriched.navn || companyInfo.styretsleder;
        finalEmail = aiEnriched.kundeEpost || companyInfo.contactEmail;
        finalPhone = aiEnriched.telefon || companyInfo.contactPhone;
        industry = aiEnriched.bransje || "";

        console.log("\n=== FINAL DATA ===");
        console.log("- Contact Person:", finalContactPerson);
        console.log("- Website (from scraped HTML only):", finalWebsite);
        console.log("- Email:", finalEmail);
        console.log("- Phone:", finalPhone);
        console.log("==================================");

        // Warn if no website found from scraping
        if (!finalWebsite) {
          console.warn(
            "⚠️ WARNING: No website found in Proff.no HTML scraping"
          );
          console.warn("⚠️ Cannot scrape company website without valid URL");
        }

        // WEBSITE FALLBACK (AFTER ENRICHMENT): Verified web search using enriched company/person
        if (!finalWebsite) {
          console.log("\n=== WEBSITE FALLBACK (AFTER ENRICHMENT) ===");
          console.log("Search using:", {
            selskap: enrichedCompanyName,
            navn: enrichedContactPerson,
          });

          try {
            const candidates =
              await openaiService.searchCompanyWebsiteCandidates(
                enrichedCompanyName,
                enrichedContactPerson
              );

            console.log(
              `Website candidates from web search: ${candidates.length}`
            );

            for (const candidate of candidates) {
              const verified = await scraperService.validateCompanyWebsite(
                candidate.url,
                enrichedCompanyName
              );

              if (verified) {
                finalWebsite = verified;
                companyInfo.website = verified;
                console.log("✅ Verified company website:", verified);
                break;
              } else {
                console.log("❌ Rejected candidate URL:", candidate.url);
              }
            }

            if (!finalWebsite) {
              console.warn("⚠️ No verified website found from web search");
            }
          } catch (e) {
            console.warn("⚠️ Website fallback search failed:", e);
          }
        }
      } catch (error) {
        console.error("AI enrichment failed, using only scraped data:", error);
        // Ensure we still use scraped website
        finalWebsite = companyInfo.website;
      }

      // Step 3: If we still need more data and have website, scrape it
      if (finalWebsite && (!finalEmail || !finalPhone)) {
        console.log(
          "\nScraping company website for additional contact info..."
        );
        try {
          const websiteInfo = await scraperService.scrapeWebsiteForContact(
            finalWebsite
          );
          if (websiteInfo.email && !finalEmail) finalEmail = websiteInfo.email;
          if (websiteInfo.phone && !finalPhone) finalPhone = websiteInfo.phone;
        } catch (error) {
          console.error("Failed to scrape website:", error);
        }
      }

      // Step 4: Use AI to analyze scraped website content if needed
      const websiteContent = scraperService.getLastWebsiteContent();

      if (
        websiteContent &&
        finalContactPerson &&
        (!finalEmail || !finalPhone)
      ) {
        console.log(
          `\nAnalyzing website content with AI for ${finalContactPerson}...`
        );

        try {
          const extractedDetails = await openaiService.extractContactDetails(
            finalContactPerson,
            websiteContent,
            companyInfo.companyName
          );

          console.log("AI extraction results:", extractedDetails);

          if (extractedDetails.email && !finalEmail) {
            finalEmail = extractedDetails.email;
          }
          if (extractedDetails.phone && !finalPhone) {
            finalPhone = extractedDetails.phone;
          }
        } catch (error) {
          console.error("AI content analysis failed:", error);
        }
      }

      // Step 4b: Targeted web-search for the contact person's profile/contact page
      // This is useful when the main crawl didn't include the right page.
      const isGenericEmail = (email: string) => {
        const e = (email || "").toLowerCase();
        return (
          !e ||
          e.startsWith("info@") ||
          e.startsWith("post@") ||
          e.startsWith("kontakt@") ||
          e.startsWith("firmapost@") ||
          e.startsWith("hello@") ||
          e.startsWith("mail@")
        );
      };

      const isLikelyGenericPhone = (phone: string) => {
        const digits = (phone || "").replace(/\D/g, "");
        if (!digits) return true;
        // Norwegian mobile numbers typically start with 4 or 9 (8 digits; +47 optional).
        const last8 = digits.length >= 8 ? digits.slice(-8) : digits;
        const first = last8[0];
        return first !== "4" && first !== "9";
      };

      const isNorwegianMobile = (phone: string) => {
        const digits = (phone || "").replace(/\D/g, "");
        if (!digits) return false;
        const last8 = digits.length >= 8 ? digits.slice(-8) : digits;
        return (
          last8.length === 8 && (last8.startsWith("4") || last8.startsWith("9"))
        );
      };

      if (
        finalWebsite &&
        finalContactPerson &&
        (isGenericEmail(finalEmail) || isLikelyGenericPhone(finalPhone))
      ) {
        console.log(
          `\nSearching for contact page for ${finalContactPerson} on ${finalWebsite}...`
        );

        try {
          const personCandidates =
            await openaiService.searchPersonContactPageCandidates(
              finalContactPerson,
              finalWebsite,
              enrichedCompanyName
            );

          console.log(
            `Person contact-page candidates from web search: ${personCandidates.length}`
          );

          let combined = websiteContent || "";

          for (const candidate of personCandidates) {
            if (
              !scraperService.isUrlOnCompanyDomain(candidate.url, finalWebsite)
            ) {
              console.log("❌ Rejected (wrong domain):", candidate.url);
              continue;
            }

            const page = await scraperService.fetchPageBodyText(candidate.url);
            if (!page.text) {
              console.log("❌ Rejected (empty fetch):", candidate.url);
              continue;
            }

            if (
              !page.text
                .toLowerCase()
                .includes(finalContactPerson.toLowerCase())
            ) {
              console.log(
                "❌ Rejected (name not found on page):",
                candidate.url
              );
              continue;
            }

            console.log("✅ Using page for extraction:", page.finalUrl);
            contactPersonPageUrl = page.finalUrl;
            combined = `${combined}\n\n${page.text}`.slice(0, 20000);
            break;
          }

          if (combined) {
            const extracted = await openaiService.extractContactDetails(
              finalContactPerson,
              combined,
              enrichedCompanyName
            );

            console.log("Targeted extraction results:", extracted);

            if (extracted.email && isGenericEmail(finalEmail)) {
              finalEmail = extracted.email;
            }
            if (extracted.phone && isNorwegianMobile(extracted.phone)) {
              finalPhone = extracted.phone;
            }
          }
        } catch (e) {
          console.error("Targeted person contact search failed:", e);
        }
      }

      // Get normalized company name (use the enriched version if available)
      const companyName =
        enrichedCompanyName || normalizeCompanyName(companyInfo.companyName);

      // Fallback to generic contact if still nothing found
      if (!finalContactPerson) {
        finalContactPerson = "Kontaktperson";
      }

      // Step 4: Generate email using OpenAI
      sendProgress("Generating email...");
      const emailContent = await openaiService.generateEmail(
        companyName,
        finalContactPerson,
        service,
        finalWebsite
      );

      // Step 5: Take screenshots and upload to Sanity
      let sanityPresentationId: string | undefined;
      let screenshots: { desktop: string; mobile: string } | undefined;

      if (finalWebsite && sanityService) {
        try {
          sendProgress("Capturing screenshots...");
          console.log(`\n=== Taking screenshots for: ${finalWebsite} ===`);
          screenshots = await screenshotService.takeScreenshots(finalWebsite);

          if (screenshots.desktop && screenshots.mobile) {
            console.log("✅ Screenshots captured successfully with data");
            console.log(`  - Desktop screenshot: ${screenshots.desktop.length} chars`);
            console.log(`  - Mobile screenshot: ${screenshots.mobile.length} chars`);

            sendProgress("Uploading to Sanity...");
            console.log("\n🎨 Preparing to create Sanity presentation...");
            console.log("  - Customer name:", companyName);
            console.log("  - Industry:", industry);
            console.log("  - Website:", finalWebsite);
            console.log("  - Service:", service);
            try {
              sanityPresentationId = await sanityService.createPresentation({
                customerName: companyName,
                description: `${service} presentation for ${companyName}`,
                beforeDesktopBase64: screenshots.desktop,
                beforeMobileBase64: screenshots.mobile,
                industry: industry || undefined,
                website: finalWebsite,
              });
              console.log("\n🎉 Sanity presentation created! ID:", sanityPresentationId);
            } catch (sanityError: any) {
              console.error("\n❌ SANITY CREATION ERROR:");
              console.error("  - Message:", sanityError.message);
              console.error("  - Stack:", sanityError.stack);
              throw sanityError;
            }
          } else {
            console.warn("⚠️ Screenshot capture returned empty data");
            console.warn(`  - Desktop length: ${screenshots?.desktop?.length || 0}`);
            console.warn(`  - Mobile length: ${screenshots?.mobile?.length || 0}`);
          }
        } catch (error: any) {
          console.error("\n❌ ===============================================");
          console.error("❌ SCREENSHOT/SANITY ERROR");
          console.error("❌ ===============================================");
          console.error("Error message:", error.message);
          console.error("Error type:", error.constructor.name);
          console.error("Error stack:", error.stack);
          console.error("❌ ===============================================\n");
          // Continue even if screenshots/sanity fail
        }
      } else {
        if (!finalWebsite) {
          console.log("⚠️ No website available - skipping screenshots");
        }
        if (!sanityService) {
          console.log("⚠️ Sanity not configured - skipping Sanity upload");
        }
      }

      // Step 6: Create Notion entry
      sendProgress("Creating Notion entry...");
      const notionPageId = await notionService.createEntry({
        companyName: companyName,
        contactPerson: finalContactPerson,
        contactPersonUrl: contactPersonPageUrl,
        email: finalEmail,
        phone: finalPhone,
        website: finalWebsite,
        proffLink: proffUrl,
        service,
        message: emailContent,
      });

      // Return success response
      const responseData = {
        success: true,
        data: {
          companyName: companyName,
          contactPerson: finalContactPerson,
          contactPersonUrl: contactPersonPageUrl,
          email: finalEmail,
          phone: finalPhone,
          website: finalWebsite,
          emailContent,
          notionPageId,
          industry: industry || "",
          sanityPresentationId: sanityPresentationId || null,
          hasScreenshots: !!screenshots,
        },
      };

      if (useSSE) {
        res.write(`data: ${JSON.stringify(responseData)}\n\n`);
        res.end();
      } else {
        res.json(responseData);
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      const errorResponse = {
        success: false,
        error: error.message || "Failed to generate content",
      };

      if (req.headers.accept?.includes("text/event-stream")) {
        res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
        res.end();
      } else {
        res.status(500).json(errorResponse);
      }
    }
  }

  async getScreenshots(req: Request, res: Response): Promise<void> {
    try {
      const { website } = req.body;

      if (!website) {
        res.status(400).json({
          success: false,
          error: "Website URL is required",
        });
        return;
      }

      const screenshotService = new ScreenshotService();
      console.log(`\nTaking screenshots for: ${website}`);

      const screenshots = await screenshotService.takeScreenshots(website);

      console.log("✅ Screenshots captured successfully");

      res.json({
        success: true,
        data: {
          desktopScreenshot: screenshots.desktop,
          mobileScreenshot: screenshots.mobile,
        },
      });
    } catch (error: any) {
      console.error("Screenshot capture failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to capture screenshots",
      });
    }
  }
}

export const generateController = new GenerateController();
