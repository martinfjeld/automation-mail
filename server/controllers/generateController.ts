import { Request, Response } from "express";
import { configManager } from "../utils/configManager";
import { ScraperService } from "../services/scraperService";
import { OpenAIService } from "../services/openaiService";
import { NotionService } from "../services/notionService";
import { ScreenshotService } from "../services/screenshotService";
import { SanityService } from "../services/sanityService";
import { LighthouseService } from "../services/lighthouseService";
import { HistoryService } from "../services/historyService";

// Normalize company name: proper capitalization and remove AS suffix, prefixes, and countries
function normalizeCompanyName(name: string): string {
  if (!name) return name;

  let normalized = name.trim();

  // Remove generic industry descriptors from ANYWHERE in the string
  // Legal - use word boundaries to avoid matching parts of words like "Advokatene"
  normalized = normalized.replace(/\bAdvokatfirmaet\b/gi, "").trim();
  normalized = normalized.replace(/\bAdvokatfirma\b/gi, "").trim();
  normalized = normalized.replace(/\bAdvokat\b/gi, "").trim();

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

      // Inject OpenAI service into scraper for AI-powered logo finding
      (scraperService as any).openaiService = openaiService;

      const notionService = new NotionService(
        config.NOTION_TOKEN,
        config.NOTION_DATABASE_ID
      );

      // Initialize Sanity service if credentials are available
      let sanityService: SanityService | null = null;
      console.log("\n🔍 Checking Sanity credentials...");
      console.log(
        "  - SANITY_PROJECT_ID:",
        config.SANITY_PROJECT_ID || "MISSING"
      );
      console.log("  - SANITY_DATASET:", config.SANITY_DATASET || "MISSING");
      console.log(
        "  - SANITY_TOKEN:",
        config.SANITY_TOKEN
          ? `${config.SANITY_TOKEN.substring(0, 10)}...`
          : "MISSING"
      );

      if (
        config.SANITY_PROJECT_ID &&
        config.SANITY_DATASET &&
        config.SANITY_TOKEN
      ) {
        console.log(
          "✅ All Sanity credentials present, initializing service..."
        );
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

      // Initialize variables that will be populated later
      let industry = ""; // Initialize early so it can be used in logo finding

      // PHASE 1: Traditional HTML Scraping from Proff.no
      console.log("=== PHASE 1: Traditional Scraping ===");
      sendProgress("Henter firmadata...");
      const companyInfo = await scraperService.getCompanyInfo(proffUrl);

      console.log("Scraped from Proff.no HTML:");
      console.log("- Company Name:", companyInfo.companyName);
      console.log("- Contact Person:", companyInfo.styretsleder);
      console.log("- Address:", (companyInfo as any).address || "NOT FOUND");
      console.log("- City:", (companyInfo as any).city || "NOT FOUND");
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

              // Find logo for the verified website
              try {
                const foundLogoUrl = await scraperService.findCompanyLogo(
                  companyInfo.companyName,
                  verified,
                  industry
                );
                if (foundLogoUrl) {
                  companyInfo.logoUrl = foundLogoUrl;
                  console.log(
                    "✅ Logo found from fallback website:",
                    foundLogoUrl
                  );
                }
              } catch (e) {
                console.error("Failed to find logo:", e);
              }

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
      sendProgress("Analyserer informasjon...");
      let finalContactPerson = companyInfo.styretsleder;
      let finalWebsite = companyInfo.website;
      let finalEmail = companyInfo.contactEmail;
      let finalPhone = companyInfo.contactPhone;
      let enrichedCompanyName = companyInfo.companyName;
      let enrichedContactPerson = companyInfo.styretsleder;
      let contactPersonPageUrl = "";
      let logoUrl = companyInfo.logoUrl || "";

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
        console.log("==================================\n");

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
            } else if (!logoUrl) {
              // Find logo if we found a website through fallback
              try {
                logoUrl = await scraperService.findCompanyLogo(
                  companyInfo.companyName,
                  finalWebsite,
                  industry
                );
                if (logoUrl) {
                  console.log(
                    "✅ Logo URL found from fallback website:",
                    logoUrl
                  );
                }
              } catch (e) {
                console.error("Failed to find logo:", e);
              }
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
      sendProgress("Genererer e-post...");
      const emailContent = await openaiService.generateEmail(
        companyName,
        finalContactPerson,
        service,
        finalWebsite
      );

      // Step 4b: Generate meeting proposals
      let meetingProposals: any[] = [];
      const myEmail = process.env.MY_EMAIL;
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      if (
        myEmail &&
        googleClientId &&
        googleClientSecret &&
        googleRefreshToken
      ) {
        try {
          sendProgress("Foreslår møtetidspunkter...");
          const { CalendarService } = await import(
            "../services/calendarService"
          );
          const calendarService = new CalendarService(
            googleClientId,
            googleClientSecret,
            googleRefreshToken
          );

          // Generate proposals for next 14 days
          const now = new Date();
          const earliestStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
          const latestEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days

          meetingProposals = await calendarService.generateProposals(
            earliestStart.toISOString(),
            latestEnd.toISOString(),
            myEmail
          );

          console.log(
            `✅ Generated ${meetingProposals.length} meeting proposals`
          );
        } catch (error: any) {
          console.error("Failed to generate meeting proposals:", error.message);
          // Continue without proposals if calendar fails
        }
      }

      // Step 5: Run Lighthouse audit if website exists (before Sanity)
      let lighthouseScores = null;
      let lighthouseSummary = null;
      if (finalWebsite && service === "Web") {
        sendProgress("Kjører Lighthouse-analyse...");
        const lighthouseService = new LighthouseService();
        lighthouseScores = await lighthouseService.auditWebsite(finalWebsite);

        if (lighthouseScores) {
          sendProgress("Genererer Lighthouse-sammendrag...");
          lighthouseSummary = await openaiService.generateLighthouseSummary(
            lighthouseScores
          );
        }
      }

      // Step 6: Take screenshots and upload to Sanity
      let sanityPresentationId: string | undefined;
      let sanityUniqueId: string | undefined;
      let screenshots: { desktop: string; mobile: string } | undefined;

      if (sanityService) {
        try {
          // Take screenshots if website exists
          if (finalWebsite) {
            sendProgress("Tar skjermbilder...");
            console.log(`\n=== Taking screenshots for: ${finalWebsite} ===`);
            screenshots = await screenshotService.takeScreenshots(finalWebsite);

            if (screenshots.desktop && screenshots.mobile) {
              console.log("✅ Screenshots captured successfully with data");
              console.log(
                `  - Desktop screenshot: ${screenshots.desktop.length} chars`
              );
              console.log(
                `  - Mobile screenshot: ${screenshots.mobile.length} chars`
              );
            } else {
              console.warn("⚠️ Screenshot capture returned empty data");
              console.warn(
                `  - Desktop length: ${screenshots?.desktop?.length || 0}`
              );
              console.warn(
                `  - Mobile length: ${screenshots?.mobile?.length || 0}`
              );
              screenshots = undefined;
            }
          } else {
            console.log(
              "⚠️ No website available - creating Sanity without screenshots"
            );
          }

          // Always create Sanity presentation (with or without screenshots)
          sendProgress("Laster opp til Sanity...");
          console.log("\n🎨 Preparing to create Sanity presentation...");
          console.log("  - Customer name:", companyName);
          console.log("  - Industry:", industry);
          console.log("  - Website:", finalWebsite || "None");
          console.log("  - Service:", service);
          console.log("  - Has screenshots:", !!screenshots);

          try {
            const sanityResult = await sanityService.createPresentation({
              customerName: companyName,
              description: `${service} presentation for ${companyName}`,
              beforeDesktopBase64: screenshots?.desktop,
              beforeMobileBase64: screenshots?.mobile,
              industry: industry || undefined,
              website: finalWebsite || undefined,
              companyLogoUrl: logoUrl || undefined,
              lighthouseScores: lighthouseScores || undefined,
              lighthouseSummary: lighthouseSummary || undefined,
            });
            sanityPresentationId = sanityResult.documentId;
            sanityUniqueId = sanityResult.uniqueId;
            console.log(
              "\n🎉 Sanity presentation created! ID:",
              sanityPresentationId
            );
            console.log("  - Unique ID:", sanityUniqueId);
          } catch (sanityError: any) {
            console.error("\n❌ SANITY CREATION ERROR:");
            console.error("  - Message:", sanityError.message);
            console.error("  - Stack:", sanityError.stack);
            throw sanityError;
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
        console.log("⚠️ Sanity not configured - skipping Sanity upload");
      }

      // Return success response
      // Build presentation URL if we have Sanity data
      const presentationUrl = sanityUniqueId
        ? `https://www.no-offence.io/presentation/${companyName
            .toLowerCase()
            .replace(/[^a-z0-9æøå]+/g, "-")
            .replace(/^-+|-+$/g, "")}/${sanityUniqueId}`
        : null;

      // Build Sanity studio URL if we have presentation ID
      const sanityStudioUrl =
        sanityPresentationId &&
        config.SANITY_PROJECT_ID &&
        config.SANITY_DATASET
          ? `https://www.sanity.io/studio/${config.SANITY_PROJECT_ID}/${config.SANITY_DATASET}/presentation;${sanityPresentationId}`
          : null;

      // Add pitch deck section to email if presentation URL exists (for Web service only)
      let finalEmailContent = emailContent;
      if (service === "Web" && presentationUrl) {
        const pitchDeckBlock = `Jeg har satt sammen en pitch deck til dere som viser et forslag til hvordan nye nettsider for dere kan se ut + et lite bilde av hvem vi er.\n${presentationUrl}`;

        // Insert before "Med vennlig hilsen," if present
        if (emailContent.includes("Med vennlig hilsen,")) {
          finalEmailContent = emailContent.replace(
            "Med vennlig hilsen,",
            `${pitchDeckBlock}\n\nMed vennlig hilsen,`
          );
        } else {
          // Otherwise append to the end
          finalEmailContent = emailContent + pitchDeckBlock;
        }
      }

      // Add meeting proposals to email
      if (meetingProposals.length === 3) {
        const baseUrl = process.env.BASE_URL || "http://localhost:3001";
        
        // Import URL shortener service
        const { UrlShortenerService } = await import(
          "../services/urlShortenerService"
        );
        const shortener = new UrlShortenerService();
        
        const meetingBlock =
          `\n\nHvis du ønsker et kort møte for å diskutere mulighetene, kan du velge et tidspunkt som passer deg:\n\n` +
          meetingProposals
            .map((proposal, index) => {
              const bookingUrl = `${baseUrl}/book/${
                proposal.bookingToken
              }?e=${encodeURIComponent(finalEmail)}&n=${encodeURIComponent(
                finalContactPerson
              )}`;
              
              // Create short URL
              const shortCode = shortener.createShortUrl(bookingUrl);
              const shortUrl = `${baseUrl}/s/${shortCode}`;
              
              return `${index + 1}. ${proposal.display} - ${shortUrl}`;
            })
            .join("\n\n");

        // Insert before "Med vennlig hilsen," if present
        if (finalEmailContent.includes("Med vennlig hilsen,")) {
          finalEmailContent = finalEmailContent.replace(
            "Med vennlig hilsen,",
            `${meetingBlock}\n\nMed vennlig hilsen,`
          );
        } else {
          // Otherwise append before the end
          finalEmailContent = finalEmailContent + meetingBlock;
        }
      }

      // Step 6: Create Notion entry (with finalEmailContent including presentation link)
      sendProgress("Oppretter Notion-oppføring...");
      let notionPageId: string;
      try {
        notionPageId = await notionService.createEntry({
          companyName: companyName,
          contactPerson: finalContactPerson,
          contactPersonUrl: contactPersonPageUrl,
          email: finalEmail,
          phone: finalPhone,
          website: finalWebsite,
          proffLink: proffUrl,
          service,
          message: finalEmailContent,
          address: (companyInfo as any).address || undefined,
          city: (companyInfo as any).city || undefined,
          sanityUrl: sanityStudioUrl || undefined,
          presentationUrl: presentationUrl || undefined,
          leadStatus: "Ikke startet",
        });
      } catch (notionError: any) {
        console.error(
          "❌ Notion creation failed, cleaning up Sanity resources..."
        );

        // Cleanup: Delete the Sanity presentation and all associated images
        if (
          sanityPresentationId &&
          config.SANITY_PROJECT_ID &&
          config.SANITY_DATASET &&
          config.SANITY_TOKEN
        ) {
          try {
            // Create sanity service if not already initialized
            const cleanupSanityService =
              sanityService ||
              new SanityService(
                config.SANITY_PROJECT_ID,
                config.SANITY_DATASET,
                config.SANITY_TOKEN
              );
            await cleanupSanityService.deletePresentation(sanityPresentationId);
            console.log(
              "✅ Sanity presentation and images cleaned up successfully"
            );
          } catch (cleanupError: any) {
            console.error(
              "⚠️ Failed to cleanup Sanity resources:",
              cleanupError.message
            );
          }
        }

        // Re-throw the original error
        throw notionError;
      }

      const responseData = {
        success: true,
        data: {
          companyName: companyName,
          contactPerson: finalContactPerson,
          contactPersonUrl: contactPersonPageUrl,
          email: finalEmail,
          phone: finalPhone,
          website: finalWebsite,
          lighthouseScores: lighthouseScores || null,
          address: (companyInfo as any).address || "",
          city: (companyInfo as any).city || "",
          emailContent: finalEmailContent,
          notionPageId,
          industry: industry || "",
          sanityPresentationId: sanityPresentationId || null,
          sanityUniqueId: sanityUniqueId || null,
          presentationUrl: presentationUrl,
          hasScreenshots: !!screenshots,
          logoUrl: logoUrl || null,
        },
      };

      // Save to history
      try {
        const historyService = new HistoryService();

        // Determine automation fields based on industry
        let automationIndustry = "Advokat";
        let automationText1 = "Advokatfirmaet";

        if (industry) {
          const industryLower = industry.toLowerCase();
          if (
            industryLower.includes("helse") ||
            industryLower.includes("aktivitet")
          ) {
            automationIndustry = "Helse";
            automationText1 = "Helsefirmaet";
          } else if (industryLower.includes("bygg")) {
            automationIndustry = "Bygg";
            automationText1 = "Entreprenør";
          } else if (
            industryLower.includes("advokat") ||
            industryLower.includes("jus")
          ) {
            automationIndustry = "Advokat";
            automationText1 = "Advokatfirmaet";
          }
        }

        // Text 2 is capitalized company name
        const automationText2 = companyName
          .split(" ")
          .map(
            (word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");

        historyService.addEntry({
          id: notionPageId, // Use Notion page ID as unique identifier
          companyName: companyName,
          contactPerson: finalContactPerson,
          email: finalEmail,
          phone: finalPhone,
          website: finalWebsite,
          address: (companyInfo as any).address || "",
          city: (companyInfo as any).city || "",
          service: service,
          notionPageId: notionPageId,
          sanityPresentationId: sanityPresentationId || undefined,
          presentationUrl: presentationUrl || undefined,
          emailContent: finalEmailContent || undefined,
          industry: industry || undefined,
          automationIndustry: automationIndustry,
          automationText1: automationText1,
          automationText2: automationText2,
          logoUrl: logoUrl || undefined,
          leadStatus: "Ikke startet",
        });
      } catch (historyError: any) {
        console.error("Failed to save to history:", historyError.message);
        // Don't fail the entire request if history save fails
      }

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
