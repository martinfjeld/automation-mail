import { createClient, SanityClient } from "@sanity/client";
import axios from "axios";
import progressController from "../controllers/progressController";

interface LighthouseScores {
  performance: number;
  accessibility: number;
  seo: number;
}

interface SanityPresentationInput {
  customerName: string;
  description?: string;
  beforeDesktopBase64?: string;
  beforeMobileBase64?: string;
  industry?: string;
  website?: string;
  companyLogoUrl?: string;
  lighthouseScores?: LighthouseScores;
  lighthouseSummary?: string;
}

export class SanityService {
  private client: SanityClient;

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static toPlainError(error: any): Record<string, any> {
    const anyErr = error as any;
    const statusCode =
      anyErr?.statusCode ??
      anyErr?.response?.statusCode ??
      anyErr?.response?.status;

    // get-it / node-request tends to put useful details under `response`.
    const response = anyErr?.response;
    const responseBody = response?.body;

    return {
      name: anyErr?.name,
      message: anyErr?.message,
      code: anyErr?.code,
      statusCode,
      // Keep small + safe primitives only
      details:
        typeof anyErr?.details === "string" ||
        typeof anyErr?.details === "number"
          ? anyErr.details
          : undefined,
      response: {
        statusCode: response?.statusCode,
        status: response?.status,
        url: response?.url,
        headers: response?.headers,
        body:
          typeof responseBody === "string" || typeof responseBody === "number"
            ? responseBody
            : undefined,
      },
      // A short stack can help, but avoid huge logs
      stack:
        typeof anyErr?.stack === "string"
          ? anyErr.stack.split("\n").slice(0, 10).join("\n")
          : undefined,
    };
  }

  private static isRetryableUploadError(error: any): boolean {
    const anyErr = error as any;
    const code = (anyErr?.code || "").toString().toUpperCase();
    const statusCode =
      anyErr?.statusCode ??
      anyErr?.response?.statusCode ??
      anyErr?.response?.status;

    // Transient network/socket errors
    const retryableCodes = new Set([
      "EPIPE",
      "ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ECONNABORTED",
    ]);
    if (retryableCodes.has(code)) return true;

    // Rate limit / server errors
    if (
      typeof statusCode === "number" &&
      (statusCode === 429 || statusCode >= 500)
    )
      return true;

    return false;
  }

  constructor(projectId: string, dataset: string, token: string) {
    console.log("🔧 Initializing Sanity client with:");
    console.log("  - Project ID:", projectId);
    console.log("  - Dataset:", dataset);
    console.log(
      "  - Token:",
      token ? `${token.substring(0, 10)}...` : "MISSING"
    );

    this.client = createClient({
      projectId,
      dataset,
      token,
      apiVersion: "2024-01-01",
      useCdn: false,
    });

    console.log("✅ Sanity client initialized successfully");
  }

  /**
   * Determine color based on percentage score
   */
  private getColorForScore(score: number): { hex: string } | undefined {
    if (score === 100) return undefined; // Perfect - no color
    if (score >= 90) return { hex: "#adffad" }; // Really good - light green
    if (score >= 50) return { hex: "#ffca8b" }; // Medium - orange
    return { hex: "#ffabab" }; // Bad - light red
  }

  /**
   * Get random static description for SEO score
   */
  private getSEODescription(score: number): string {
    const excellent = [
      "Utmerket søkbarhet",
      "Svært godt optimalisert",
      "Topp rangering",
      "Perfekt SEO-struktur",
      "Eksemplarisk søkemotor-vennlig",
      "Fremragende SEO-praksis",
      "Optimal synlighet",
      "Førsteklasses SEO",
      "Imponerende optimalisering",
      "Profesjonell SEO-struktur",
    ];

    const good = [
      "God søkbarhet",
      "Solid SEO-grunnlag",
      "Bra optimalisering",
      "Fungerer godt",
      "God synlighet",
      "Tilfredsstillende struktur",
      "Akseptabel optimalisering",
      "Greit SEO-arbeid",
      "Funksjonell struktur",
      "Jevnt over bra",
    ];

    const poor = [
      "Trenger SEO-arbeid",
      "Svak optimalisering",
      "Mangelfull struktur",
      "Forbedringspotensial",
      "Dårlig synlighet",
      "Krever oppgradering",
      "Utilstrekkelig SEO",
      "Må forbedres",
      "Svakt fundament",
      "Kritiske mangler",
    ];

    const list = score >= 90 ? excellent : score >= 50 ? good : poor;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Get random static description for Accessibility score
   */
  private getAccessibilityDescription(score: number): string {
    const excellent = [
      "Fullt tilgjengelig",
      "Universell utforming",
      "Perfekt inkludering",
      "Alle kan bruke siden",
      "Eksemplarisk tilgjengelighet",
      "Førsteklasses UU",
      "Optimal brukervennlighet",
      "Fremragende tilrettelegging",
      "Imponerende UU-arbeid",
      "Profesjonell tilgjengelighet",
    ];

    const good = [
      "God tilgjengelighet",
      "Bra UU-struktur",
      "Fungerer for de fleste",
      "Akseptabel inkludering",
      "Tilfredsstillende UU",
      "Greit tilrettelagt",
      "Solid grunnlag",
      "Brukervennlig nok",
      "Jevnt over tilgjengelig",
      "Funksjonell for mange",
    ];

    const poor = [
      "Dårlig tilgjengelighet",
      "Mangler UU-arbeid",
      "Ekskluderende design",
      "Vanskelig for mange",
      "Kritiske UU-mangler",
      "Må forbedre inkludering",
      "Utilstrekkelig tilrettelegging",
      "Trenger UU-oppgradering",
      "Barrierer finnes",
      "Problematisk struktur",
    ];

    const list = score >= 90 ? excellent : score >= 50 ? good : poor;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Get random static description for Performance score
   */
  private getPerformanceDescription(score: number): string {
    const excellent = [
      "Lynrask lasting",
      "Utmerket hastighet",
      "Perfekt ytelse",
      "Optimal responstid",
      "Eksemplarisk fart",
      "Førsteklasses hastighet",
      "Imponerende lastetid",
      "Svært rask side",
      "Fremragende ytelse",
      "Toppnivå hastighet",
    ];

    const good = [
      "God hastighet",
      "Akseptabel ytelse",
      "Bra lastetid",
      "Fungerer raskt nok",
      "Tilfredsstillende fart",
      "Greit tempo",
      "Brukbar respons",
      "Jevnt over rask",
      "Solid hastighet",
      "Funksjonell ytelse",
    ];

    const poor = [
      "Treg lasting",
      "Dårlig ytelse",
      "Langsom side",
      "Må optimaliseres",
      "Kritisk treig",
      "Problematisk hastighet",
      "Utilstrekkelig fart",
      "Trenger hastighetsforbedring",
      "Frustrerende lastetid",
      "Svak ytelse",
    ];

    const list = score >= 90 ? excellent : score >= 50 ? good : poor;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Create a slug from company name
   * Removes common prefixes, suffixes, and converts to lowercase with hyphens
   */
  private createSlug(companyName: string): string {
    let slug = companyName.toLowerCase();

    // Remove common prefixes
    slug = slug.replace(/^(advokatfirmaet|advokatfirma|as|asa|the|)\s+/i, "");

    // Remove common suffixes
    slug = slug.replace(
      /\s+(as|asa|norge|norway|sweden|sverige|denmark|danmark)$/i,
      ""
    );

    // Remove any remaining "AS" or similar
    slug = slug.replace(/\s+as\s+/gi, " ");

    // Replace spaces and special characters with hyphens
    slug = slug
      .trim()
      .replace(/[^a-z0-9æøå\s-]/g, "") // Keep letters, numbers, norwegian chars, spaces, hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

    console.log(`📝 Created slug: "${companyName}" → "${slug}"`);
    return slug;
  }
  private mapIndustryType(industry?: string): string {
    if (!industry) {
      console.log("⚠️ No industry provided, using custom");
      return "custom";
    }

    const industryLower = industry.toLowerCase();
    console.log("🔍 Mapping industry:", industry, "→", industryLower);

    // Map Norwegian/English industry names to Sanity types
    // Law/Legal
    if (
      industryLower.includes("advokat") ||
      industryLower.includes("lawyer") ||
      industryLower.includes("juridisk") ||
      industryLower.includes("jus")
    ) {
      console.log("✅ Matched: advokatbransjen");
      return "advokatbransjen";
    }

    // Construction
    if (
      industryLower.includes("bygg") ||
      industryLower.includes("construction") ||
      industryLower.includes("entreprenør") ||
      industryLower.includes("entrepr") ||
      industryLower.includes("anlegg") ||
      industryLower.includes("tak")
    ) {
      console.log("✅ Matched: byggebransjen");
      return "byggebransjen";
    }

    // Healthcare/Fitness
    if (
      industryLower.includes("helse") ||
      industryLower.includes("health") ||
      industryLower.includes("aktivitet") ||
      industryLower.includes("fitness") ||
      industryLower.includes("trening") ||
      industryLower.includes("gym") ||
      industryLower.includes("medisin")
    ) {
      console.log("✅ Matched: helsebransjen");
      return "helsebransjen";
    }

    // Default to custom if no match
    console.log("⚠️ No match found, using custom");
    return "custom";
  }

  /**
   * Upload a base64 image to Sanity
   */
  private async uploadImage(
    base64Data: string,
    filename: string,
    contentType: string = "image/png"
  ): Promise<any> {
    console.log(`📤 Uploading ${filename}...`);
    console.log(`  - Base64 data length: ${base64Data.length} chars`);
    console.log(`  - Content type: ${contentType}`);

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    console.log(
      `  - Buffer size: ${buffer.length} bytes (${(
        buffer.length /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `  - Starting upload to Sanity... (attempt ${attempt}/${maxAttempts})`
        );
        const asset = await this.client.assets.upload("image", buffer, {
          filename,
          contentType,
        });

        console.log(`✅ Uploaded ${filename} to Sanity:`, asset._id);
        return asset;
      } catch (error: any) {
        const plain = SanityService.toPlainError(error);
        console.error(
          `❌ Failed to upload ${filename} to Sanity (attempt ${attempt}/${maxAttempts}):`
        );
        console.error(`  - Error:`, plain);

        const shouldRetry =
          attempt < maxAttempts && SanityService.isRetryableUploadError(error);
        if (shouldRetry) {
          const backoffMs = 800 * attempt;
          console.warn(`  - Retrying in ${backoffMs}ms...`);
          await SanityService.sleep(backoffMs);
          continue;
        }

        throw error;
      }
    }

    // Should be unreachable (we either return or throw), but keeps TS happy.
    throw new Error(
      `Failed to upload ${filename} to Sanity after ${maxAttempts} attempts`
    );
  }

  /**
   * Download an image from URL and upload to Sanity
   */
  private async uploadImageFromUrl(imageUrl: string, filename: string) {
    try {
      console.log(`📥 Downloading image from URL: ${imageUrl}`);
      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          Accept: "image/*",
          "User-Agent": "figma-automator/1.0",
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentTypeHeader = response.headers?.["content-type"];
      const contentType =
        typeof contentTypeHeader === "string" &&
        contentTypeHeader.startsWith("image/")
          ? contentTypeHeader
          : "image/png";

      const buffer = Buffer.from(response.data);
      console.log(
        `  - Downloaded ${buffer.length} bytes (content-type: ${contentType})`
      );

      console.log(`  - Uploading ${filename} to Sanity...`);
      const asset = await this.client.assets.upload("image", buffer, {
        filename,
        contentType,
      });
      console.log(`✅ Uploaded ${filename} to Sanity:`, asset._id);
      return asset;
    } catch (error: any) {
      console.error(
        `⚠️ Failed to upload image from URL (${imageUrl}):`,
        error?.message || error
      );
      return null;
    }
  }

  /**
   * Create a new presentation in Sanity with before images
   */
  async createPresentation(
    input: SanityPresentationInput
  ): Promise<{ documentId: string; uniqueId: string }> {
    try {
      console.log("\n=== Creating Sanity Presentation ===");
      console.log("Customer:", input.customerName);
      console.log("Description:", input.description);
      console.log("Industry:", input.industry);
      console.log("Website:", input.website);
      console.log("Company logo URL:", input.companyLogoUrl);
      console.log("Has desktop base64:", !!input.beforeDesktopBase64);
      console.log("Has mobile base64:", !!input.beforeMobileBase64);
      console.log("Has Lighthouse scores:", !!input.lighthouseScores);
      if (input.lighthouseScores) {
        console.log(
          "  - Performance:",
          input.lighthouseScores.performance,
          "%"
        );
        console.log(
          "  - Accessibility:",
          input.lighthouseScores.accessibility,
          "%"
        );
        console.log("  - SEO:", input.lighthouseScores.seo, "%");
      }

      // Upload the before images (if provided)
      let beforeDesktopAsset: any = null;
      let beforeMobileAsset: any = null;

      if (input.beforeDesktopBase64 && input.beforeMobileBase64) {
        console.log("\n📤 Step 1: Uploading before images...");
        beforeDesktopAsset = await this.uploadImage(
          input.beforeDesktopBase64,
          `before-desktop-${Date.now()}.png`
        );

        beforeMobileAsset = await this.uploadImage(
          input.beforeMobileBase64,
          `before-mobile-${Date.now()}.png`
        );

        console.log("\n✅ Both images uploaded successfully");
        console.log("  - Desktop asset ID:", beforeDesktopAsset._id);
        console.log("  - Mobile asset ID:", beforeMobileAsset._id);
      } else {
        console.log(
          "\n⚠️ No screenshots provided - skipping before/after slide"
        );
      }

      // Upload company logo (best-effort)
      let companyLogoAsset: any = null;
      if (input.companyLogoUrl) {
        console.log("\n📤 Step 1b: Uploading company logo...");
        companyLogoAsset = await this.uploadImageFromUrl(
          input.companyLogoUrl,
          `company-logo-${Date.now()}.png`
        );
        if (companyLogoAsset?._id) {
          console.log("  - Company logo asset ID:", companyLogoAsset._id);
        } else {
          console.log("  - Company logo upload skipped/failed");
        }
      }

      // Generate a random unique ID
      console.log(
        "\n📝 Step 2: Generating unique ID and preparing document..."
      );
      const uniqueId = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Create the presentation document
      const industryType = this.mapIndustryType(input.industry);
      console.log("\n📄 Step 3: Creating presentation document...");
      console.log("  - Unique ID:", uniqueId);
      console.log("  - Industry:", input.industry, "→", industryType);

      console.log("\n🚀 Sending create request to Sanity...");
      const newPresentation = await (this.client as any).create({
        _type: "presentation",
        customerName: input.customerName,
        uniqueId,
        description:
          input.description || `Presentation for ${input.customerName}`,
        industryType,
        isPublished: false,
        ...(companyLogoAsset?._id
          ? {
              companyLogo: {
                _type: "image",
                asset: {
                  _type: "reference",
                  _ref: companyLogoAsset._id,
                },
              },
            }
          : {}),
        slides: [
          // 1. Logo slide
          {
            _type: "slide",
            _key: "slide-1",
            title: "Logo slide",
            slideType: "title",
            backgroundTheme: "dark",
            transition: "slide",
            ...(companyLogoAsset?._id
              ? {
                  mainVisual: {
                    _type: "image",
                    asset: {
                      _type: "reference",
                      _ref: companyLogoAsset._id,
                    },
                  },
                }
              : {}),
          },
          // 2. Pitch Deck
          {
            _type: "slide",
            _key: "slide-2",
            title: "Pitch Deck",
            slideType: "fullsizeTitle",
            heading: "Pitch",
            subheading: "DECK",
            date: new Date().toLocaleDateString("no-NO"),
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 3. Om oss
          {
            _type: "slide",
            _key: "slide-3",
            title: "Om oss",
            slideType: "aboutUs",
            heading: "Om oss",
            backgroundTheme: "light",
            transition: "slide",
            teamMembers: [
              {
                _type: "reference",
                _ref: "1de0b230-eade-45bc-952d-78e7c1a386fe",
              },
              {
                _type: "reference",
                _ref: "e7a86a3a-79b0-4540-a4b0-20ea187ef267",
              },
            ],
          },
          // 4. Hva vi gjør
          {
            _type: "slide",
            _key: "slide-4",
            title: "Hva vi gjør",
            slideType: "whatWeDo",
            heading: "Hva vi gjør",
            backgroundTheme: "dark",
            transition: "slide",
            whatWeDoItems: [
              {
                icon: "triangle",
                description: "Bygger merkevarer som står ut i markedet",
              },
              {
                icon: "hexagon",
                description:
                  "Leverer nettsider med strategi, design og teknikk i ett.",
              },
              {
                icon: "wave",
                description:
                  "Produserer film og foto som løfter historien visuelt.",
              },
              {
                icon: "arch",
                description:
                  "Utvikler interaktive opplevelser med React, GSAP og Sanity.",
              },
            ],
          },
          // 5. Før & etter (with uploaded images) - only if screenshots provided
          ...(beforeDesktopAsset && beforeMobileAsset
            ? [
                {
                  _type: "slide",
                  _key: "slide-5",
                  title: "Før & etter",
                  slideType: "beforeAfter",
                  heading: "Før & etter",
                  subheading: "Før & Etter",
                  backgroundTheme: "dark",
                  transition: "slide",
                  beforeImage: {
                    _type: "image",
                    asset: {
                      _type: "reference",
                      _ref: beforeDesktopAsset._id,
                    },
                  },
                  beforeImageMobile: {
                    _type: "image",
                    asset: {
                      _type: "reference",
                      _ref: beforeMobileAsset._id,
                    },
                  },
                  // afterImage and afterImageMobile left empty - will use industry preset
                },
              ]
            : []),
          // 5b. Statistics (Lighthouse scores) - only if scores provided
          ...(input.lighthouseScores && input.lighthouseSummary
            ? [
                {
                  _type: "slide",
                  _key: "slide-5b",
                  title: "Website Statistics",
                  slideType: "statistics",
                  heading: "Ytelse",
                  backgroundTheme: "dark",
                  transition: "slide",
                  summaryTitle: "Nettsiden deres i dag:",
                  summaryDescription: input.lighthouseSummary,
                  statistics: [
                    {
                      _type: "object",
                      percentage: input.lighthouseScores.seo,
                      title: "SEO",
                    },
                    {
                      _type: "object",
                      percentage: input.lighthouseScores.performance,
                      title: "Ytelse",
                    },
                    {
                      _type: "object",
                      percentage: input.lighthouseScores.accessibility,
                      title: "Tilgjengelighet",
                    },
                  ],
                },
              ]
            : []),
          // 6. Fullskjerm bilde
          {
            _type: "slide",
            _key: "slide-6",
            title: "Fullskjerm bilde",
            slideType: "fullScreenVisual",
            mediaType: "image",
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 7. Bildeoppsett
          {
            _type: "slide",
            _key: "slide-7",
            title: "Bildeoppsett",
            slideType: "imageLayout",
            heading: "Rebrand",
            subheading: "",
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 8. Fullskjerm video
          {
            _type: "slide",
            _key: "slide-8",
            title: "Fullskjerm video",
            slideType: "fullScreenVisual",
            mediaType: "video",
            backgroundTheme: "light",
            transition: "slide",
          },
          // 9. Klienter (with default logos)
          {
            _type: "slide",
            _key: "slide-9",
            title: "Klienter",
            slideType: "clients",
            heading: "Klienter",
            backgroundTheme: "dark",
            transition: "slide",
            clientLogos: [
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-c9f271d6c7546d77b947cb4b3db695fff1358cec-193x28-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-ee570d287bfffdee5b09d92f12613f2e92a1140f-142x42-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-5afd7c89778e82964ac6ec38d3a040800300be85-1917x756-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-3545105e4b346fd19a185b33ee4db47ee9adbf9f-155x35-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-b41cb8cd56b37862b87d7539a5f8793bad2fe009-192x21-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-9aad914256dfb2befe85a01c07dea7c8c6efc228-41x42-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-4a7a6e0aa66c61dc8bcd9dbe3315d4d6a11fad01-53x28-svg",
                  },
                },
              },
              {
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "image-0dd68689514a337312b7206cc357a37baa952aef-202x37-svg",
                  },
                },
              },
            ],
          },
          // 10. Ballpark
          {
            _type: "slide",
            _key: "slide-10",
            title: "Ballpark",
            slideType: "ballpark",
            heading: "Prisliste",
            backgroundTheme: "dark",
            transition: "slide",
            ballparkCard1: {
              title: "Standard",
              price: 20000,
              monthlyPrice: 2500,
              descriptionType: "list",
              descriptionText:
                "For selskaper som trenger én tydelig leveranse for å komme raskt og riktig i gang.",
              descriptionList: [
                "Idé og kreativ retning",
                "Én leveranse (nettside eller film)",
                "Tydelig budskap og struktur",
                "Produksjon og ferdigstilling",
                "Tilpasset valgt kanal",
              ],
            },
            ballparkCard2: {
              title: "Plus",
              price: 60000,
              monthlyPrice: 6000,
              descriptionType: "list",
              descriptionText:
                "For selskaper som vil samle nettside, film og visuelt uttrykk i én helhet.",
              descriptionList: [
                "Konsept og visuelt uttrykk",
                "Nettside eller kampanjeside",
                "Film og/eller visuelt innhold",
                "Sammenheng på tvers av flater",
                "Levering klar til publisering",
              ],
            },
            ballparkCard3: {
              title: "No Offence",
              price: 150000,
              monthlyPrice: 12500,
              descriptionType: "list",
              descriptionText:
                "For selskaper som trenger en komplett løsning der strategi, innhold og uttrykk henger sammen.",
              descriptionList: [
                "Strategi og målsetting",
                "Kreativt hovedkonsept",
                "Nettside med innhold",
                "Film, foto og kampanjemateriell",
                "Helhetlig leveranse klar for lansering",
              ],
            },
          },
        ],
      });

      console.log("\n🎉 ✅ Sanity presentation created successfully!");
      console.log("  - Document ID:", newPresentation._id);
      console.log("  - Unique ID:", uniqueId);
      console.log("  - Customer name:", newPresentation.customerName);

      return {
        documentId: newPresentation._id,
        uniqueId: uniqueId,
      };
    } catch (error: any) {
      console.error("\n❌ ===============================================");
      console.error("❌ FAILED TO CREATE SANITY PRESENTATION");
      console.error("❌ ===============================================");
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
      console.error("Error code:", error.code);
      console.error("Error response:", error.response?.body || error.response);
      console.error("Full error:", error);
      console.error("Stack trace:", error.stack);
      console.error("❌ ===============================================\n");
      throw error;
    }
  }

  /**
   * Update an existing presentation with after images
   */
  async updatePresentationAfterImages(
    presentationId: string,
    afterDesktopBase64: string,
    afterMobileBase64: string
  ): Promise<void> {
    try {
      console.log("\n=== Updating Sanity Presentation ===");
      console.log("Presentation ID:", presentationId);

      // Upload the after images
      console.log("Uploading after images...");
      const afterDesktopAsset = await this.uploadImage(
        afterDesktopBase64,
        `after-desktop-${Date.now()}.png`
      );

      const afterMobileAsset = await this.uploadImage(
        afterMobileBase64,
        `after-mobile-${Date.now()}.png`
      );

      // Fetch current presentation
      const presentation = await (this.client as any).getDocument(
        presentationId
      );

      if (!presentation || !presentation.slides) {
        throw new Error("Presentation not found or has no slides");
      }

      // Find the beforeAfter slide and update it
      const updatedSlides = presentation.slides.map((slide: any) => {
        if (slide.slideType === "beforeAfter") {
          return {
            ...slide,
            afterImage: {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: afterDesktopAsset._id,
              },
            },
            afterImageMobile: {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: afterMobileAsset._id,
              },
            },
          };
        }
        return slide;
      });

      // Update the presentation
      await (this.client as any)
        .patch(presentationId)
        .set({ slides: updatedSlides })
        .commit();

      console.log("✅ Sanity presentation updated with after images");
    } catch (error: any) {
      console.error("Failed to update Sanity presentation:", error.message);
      throw error;
    }
  }

  /**
   * Update imageLayout slide with mockup images
   * Maps: 4_mockup.jpg → imageLayoutC, 1_mockup.jpg → imageLayoutD, 3_mockup.jpg → imageLayoutE, 2_mockup.jpg → imageLayoutA
   * Also updates beforeAfter slide: 1.jpg → afterImage, 2.jpg → afterImageMobile
   */
  async updateImageLayoutSlide(
    presentationId: string,
    mockupImages: { filename: string; base64Data: string }[]
  ): Promise<void> {
    try {
      console.log("\n=== Updating Slides with Images ===");
      console.log("Presentation ID:", presentationId);
      console.log("Number of images:", mockupImages.length);

      // Separate mockup images from before/after images
      const layoutImages = mockupImages.filter((img) =>
        [
          "1_mockup.jpg",
          "2_mockup.jpg",
          "3_mockup.jpg",
          "4_mockup.jpg",
        ].includes(img.filename)
      );
      const beforeAfterImages = mockupImages.filter((img) =>
        ["1.jpg", "2.jpg"].includes(img.filename)
      );

      // Upload all images to Sanity
      const uploadedAssets: Record<string, any> = {};

      for (const image of mockupImages) {
        console.log(`Uploading ${image.filename}...`);
        const asset = await this.uploadImage(
          image.base64Data,
          `${image.filename}-${Date.now()}.jpg`
        );
        uploadedAssets[image.filename] = asset;
      }

      // Fetch current presentation
      const presentation = await (this.client as any).getDocument(
        presentationId
      );

      if (!presentation || !presentation.slides) {
        throw new Error("Presentation not found or has no slides");
      }

      // Update slides
      let foundImageLayoutSlide = false;
      let foundBeforeAfterSlide = false;
      let foundFirstFullScreenVisual = false;

      const updatedSlides = presentation.slides.map((slide: any) => {
        // Update imageLayout slide
        if (slide.slideType === "imageLayout" && layoutImages.length > 0) {
          foundImageLayoutSlide = true;
          console.log("\n📋 Found imageLayout slide");

          const updatedSlide = { ...slide };

          // Map filenames to image slots
          if (uploadedAssets["4_mockup.jpg"]) {
            console.log(
              "Setting imageLayoutC with asset:",
              uploadedAssets["4_mockup.jpg"]._id
            );
            updatedSlide.imageLayoutC = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["4_mockup.jpg"]._id,
              },
            };
          }

          if (uploadedAssets["1_mockup.jpg"]) {
            console.log(
              "Setting imageLayoutD with asset:",
              uploadedAssets["1_mockup.jpg"]._id
            );
            updatedSlide.imageLayoutD = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["1_mockup.jpg"]._id,
              },
            };
          }

          if (uploadedAssets["3_mockup.jpg"]) {
            console.log(
              "Setting imageLayoutE with asset:",
              uploadedAssets["3_mockup.jpg"]._id
            );
            updatedSlide.imageLayoutE = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["3_mockup.jpg"]._id,
              },
            };
          }

          if (uploadedAssets["2_mockup.jpg"]) {
            console.log(
              "Setting imageLayoutA with asset:",
              uploadedAssets["2_mockup.jpg"]._id
            );
            updatedSlide.imageLayoutA = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["2_mockup.jpg"]._id,
              },
            };
          }

          return updatedSlide;
        }

        // Update first fullScreenVisual slide with 1_mockup.jpg
        if (
          slide.slideType === "fullScreenVisual" &&
          !foundFirstFullScreenVisual &&
          uploadedAssets["1_mockup.jpg"]
        ) {
          foundFirstFullScreenVisual = true;
          console.log("\n📋 Found first fullScreenVisual slide");

          const updatedSlide = { ...slide };

          console.log(
            "Setting fullScreenImage with asset:",
            uploadedAssets["1_mockup.jpg"]._id
          );
          updatedSlide.fullScreenImage = {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: uploadedAssets["1_mockup.jpg"]._id,
            },
          };

          return updatedSlide;
        }

        // Update beforeAfter slide
        if (slide.slideType === "beforeAfter" && beforeAfterImages.length > 0) {
          foundBeforeAfterSlide = true;
          console.log("\n📋 Found beforeAfter slide");

          const updatedSlide = { ...slide };

          // 1.jpg → afterImage
          if (uploadedAssets["1.jpg"]) {
            console.log(
              "Setting afterImage with asset:",
              uploadedAssets["1.jpg"]._id
            );
            updatedSlide.afterImage = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["1.jpg"]._id,
              },
            };
          }

          // 2.jpg → afterImageMobile
          if (uploadedAssets["2.jpg"]) {
            console.log(
              "Setting afterImageMobile with asset:",
              uploadedAssets["2.jpg"]._id
            );
            updatedSlide.afterImageMobile = {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAssets["2.jpg"]._id,
              },
            };
          }

          return updatedSlide;
        }

        return slide;
      });

      if (layoutImages.length > 0 && !foundImageLayoutSlide) {
        console.error("❌ No imageLayout slide found in presentation!");
      }

      if (beforeAfterImages.length > 0 && !foundBeforeAfterSlide) {
        console.error("❌ No beforeAfter slide found in presentation!");
      }

      // Update the presentation
      await (this.client as any)
        .patch(presentationId)
        .set({ slides: updatedSlides })
        .commit();

      console.log("✅ Sanity slides updated with images");
    } catch (error: any) {
      console.error("Failed to update slides:", error.message);
      throw error;
    }
  }

  /**
   * Upload generated files (mockups and videos) to Sanity
   */
  async uploadGeneratedFiles(
    presentationId: string,
    mockupFiles: { [key: string]: Buffer },
    beforeAfterFiles: { [key: string]: Buffer },
    videoFiles: { [key: string]: Buffer },
    industryPrefix: string,
    clientId?: string
  ): Promise<void> {
    try {
      console.log("\n=== Uploading Generated Files to Sanity ===");
      console.log(`Mockup files received: ${Object.keys(mockupFiles).length}`);
      console.log(
        `Before/After files received: ${Object.keys(beforeAfterFiles).length}`
      );
      console.log(`Video files received: ${Object.keys(videoFiles).length}`);

      // Check if we have any files to upload
      if (
        Object.keys(mockupFiles).length === 0 &&
        Object.keys(beforeAfterFiles).length === 0 &&
        Object.keys(videoFiles).length === 0
      ) {
        const errorMsg =
          "⚠️ No files found to upload. Please check that the Python automation generated the files correctly.";
        console.error(errorMsg);
        if (clientId) progressController.sendProgress(clientId, errorMsg);
        throw new Error("No files to upload");
      }

      // Fetch current presentation
      const presentation: any = await (this.client as any).getDocument(
        presentationId
      );
      if (!presentation) {
        throw new Error(`Presentation ${presentationId} not found`);
      }

      const updatedSlides = [...(presentation.slides || [])];

      // Upload mockup images
      const uploadedMockups: { [key: string]: any } = {};
      const mockupMapping: { [key: string]: string } = {
        "1_mockup.jpg": "D",
        "2_mockup.jpg": "A",
        "3_mockup.jpg": "E",
        "4_mockup.jpg": "C",
      };

      let firstFullScreenImage: any = null;

      for (const [filename, imageField] of Object.entries(mockupMapping)) {
        if (mockupFiles[filename]) {
          const msg = `Uploading ${filename}...`;
          console.log(msg);
          if (clientId) progressController.sendProgress(clientId, msg);

          const asset = await this.client.assets.upload(
            "image",
            mockupFiles[filename],
            {
              filename: filename,
            }
          );

          const imageRef = {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: asset._id,
            },
          };

          uploadedMockups[imageField] = imageRef;
          const successMsg = `✓ Uploaded ${filename} as imageLayout${imageField}`;
          console.log(successMsg);
          if (clientId) progressController.sendProgress(clientId, successMsg);

          // Also save 1_mockup.jpg for first fullScreenVisual
          if (filename === "1_mockup.jpg") {
            firstFullScreenImage = imageRef;
          }
        }
      }

      // Find and update imageLayout slide
      const imageLayoutIndex = updatedSlides.findIndex(
        (slide: any) => slide.slideType === "imageLayout"
      );

      if (imageLayoutIndex !== -1 && Object.keys(uploadedMockups).length > 0) {
        const imageLayoutSlide = { ...updatedSlides[imageLayoutIndex] };

        // Update images
        for (const [field, imageData] of Object.entries(uploadedMockups)) {
          imageLayoutSlide[`imageLayout${field}`] = imageData;
          console.log(`  → Set imageLayout${field}`);
        }

        updatedSlides[imageLayoutIndex] = imageLayoutSlide;
        const msg = "✓ Updated imageLayout slide with mockups";
        console.log(msg);
        if (clientId) progressController.sendProgress(clientId, msg);
      } else {
        console.warn("⚠ imageLayout slide not found or no mockups to upload");
      }

      // Upload and update beforeAfter images
      const uploadedBeforeAfter: { [key: string]: any } = {};

      for (const [filename, buffer] of Object.entries(beforeAfterFiles)) {
        const msg = `Uploading ${filename}...`;
        console.log(msg);
        if (clientId) progressController.sendProgress(clientId, msg);

        const asset = await this.client.assets.upload("image", buffer, {
          filename: filename,
        });

        const imageRef = {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: asset._id,
          },
        };

        if (filename === "1.jpg") {
          uploadedBeforeAfter.afterImage = imageRef;
        } else if (filename === "2.jpg") {
          uploadedBeforeAfter.afterImageMobile = imageRef;
        }
        const successMsg = `✓ Uploaded ${filename}`;
        console.log(successMsg);
        if (clientId) progressController.sendProgress(clientId, successMsg);
      }

      // Find and update beforeAfter slide
      const beforeAfterIndex = updatedSlides.findIndex(
        (slide: any) => slide.slideType === "beforeAfter"
      );

      if (
        beforeAfterIndex !== -1 &&
        Object.keys(uploadedBeforeAfter).length > 0
      ) {
        const beforeAfterSlide = { ...updatedSlides[beforeAfterIndex] };

        if (uploadedBeforeAfter.afterImage) {
          beforeAfterSlide.afterImage = uploadedBeforeAfter.afterImage;
          console.log("  → Set afterImage");
        }
        if (uploadedBeforeAfter.afterImageMobile) {
          beforeAfterSlide.afterImageMobile =
            uploadedBeforeAfter.afterImageMobile;
          console.log("  → Set afterImageMobile");
        }

        updatedSlides[beforeAfterIndex] = beforeAfterSlide;
        const msg = "✓ Updated beforeAfter slide with images";
        console.log(msg);
        if (clientId) progressController.sendProgress(clientId, msg);
      } else {
        console.warn(
          "⚠ beforeAfter slide not found or no before/after images to upload"
        );
      }

      // Find and update first fullScreenVisual slide with 1_mockup.jpg
      if (firstFullScreenImage) {
        const fullScreenVisualIndices: number[] = [];
        updatedSlides.forEach((slide: any, index: number) => {
          if (slide.slideType === "fullScreenVisual") {
            fullScreenVisualIndices.push(index);
          }
        });

        if (fullScreenVisualIndices.length > 0) {
          const firstIndex = fullScreenVisualIndices[0];
          const firstFullScreenSlide = { ...updatedSlides[firstIndex] };

          firstFullScreenSlide.fullScreenImage = firstFullScreenImage;
          updatedSlides[firstIndex] = firstFullScreenSlide;
          console.log(
            `✓ Updated first fullScreenVisual slide (index ${firstIndex}) with 1_mockup.jpg`
          );
        } else {
          console.warn("⚠ No fullScreenVisual slides found");
        }
      }

      // Upload videos
      const uploadedVideos: { desktop?: any; mobile?: any } = {};

      for (const [filename, buffer] of Object.entries(videoFiles)) {
        const msg = `Uploading ${filename}...`;
        console.log(msg);
        if (clientId) progressController.sendProgress(clientId, msg);

        // Determine content type based on file extension
        const contentType = filename.endsWith(".mov")
          ? "video/quicktime"
          : "video/mp4";

        const asset = await this.client.assets.upload("file", buffer, {
          filename: filename,
          contentType: contentType,
        });

        const videoRef = {
          _type: "file",
          asset: {
            _type: "reference",
            _ref: asset._id,
          },
        };

        if (filename.includes("_mobile")) {
          uploadedVideos.mobile = videoRef;
        } else {
          uploadedVideos.desktop = videoRef;
        }
        const successMsg = `✓ Uploaded ${filename}`;
        console.log(successMsg);
        if (clientId) progressController.sendProgress(clientId, successMsg);
      }

      // Find last fullScreenVisual slide and update videos
      const fullScreenVisualIndices: number[] = [];
      updatedSlides.forEach((slide: any, index: number) => {
        if (slide.slideType === "fullScreenVisual") {
          fullScreenVisualIndices.push(index);
        }
      });

      if (
        fullScreenVisualIndices.length > 0 &&
        (uploadedVideos.desktop || uploadedVideos.mobile)
      ) {
        const lastIndex =
          fullScreenVisualIndices[fullScreenVisualIndices.length - 1];
        const fullScreenSlide = { ...updatedSlides[lastIndex] };

        if (uploadedVideos.desktop) {
          fullScreenSlide.fullScreenVideo = uploadedVideos.desktop;
          console.log("  → Set fullScreenVideo");
        }
        if (uploadedVideos.mobile) {
          fullScreenSlide.fullScreenVideoMobile = uploadedVideos.mobile;
          console.log("  → Set fullScreenVideoMobile");
        }

        updatedSlides[lastIndex] = fullScreenSlide;
        console.log(
          `✓ Updated last fullScreenVisual slide (index ${lastIndex}) with videos`
        );
      } else {
        console.warn(
          "⚠ No fullScreenVisual slides found or no videos to upload"
        );
      }

      // Update the presentation
      await (this.client as any)
        .patch(presentationId)
        .set({ slides: updatedSlides })
        .commit();

      const finalMsg = "✅ All generated files uploaded successfully";
      console.log(finalMsg);
      if (clientId) progressController.sendProgress(clientId, finalMsg);
    } catch (error: any) {
      console.error("Failed to upload generated files:", error.message);
      throw error;
    }
  }

  /**
   * Update the customer name in a Sanity presentation
   */
  async updateCustomerName(
    presentationId: string,
    newCustomerName: string
  ): Promise<void> {
    try {
      console.log(
        `Updating customer name in Sanity presentation ${presentationId}...`
      );
      console.log(`  - New customer name: ${newCustomerName}`);

      // Generate new slug from the new customer name
      const newSlug = this.createSlug(newCustomerName);
      console.log(`  - New slug: ${newSlug}`);

      await (this.client as any)
        .patch(presentationId)
        .set({
          customerName: newCustomerName,
          slug: {
            _type: "slug",
            current: newSlug,
          },
        })
        .commit();

      console.log("✅ Customer name and slug updated successfully in Sanity");
    } catch (error: any) {
      console.error("Failed to update customer name in Sanity:", error.message);
      throw error;
    }
  }

  /**
   * Upload logo and update presentation
   */
  async uploadAndUpdateLogo(
    presentationId: string,
    imageData: string,
    fileType?: string,
    fileName?: string
  ): Promise<string> {
    try {
      console.log(`Uploading logo for presentation ${presentationId}...`);

      // Determine file extension and content type
      let extension = "png";
      let contentType = "image/png";

      if (fileType) {
        contentType = fileType;
        if (fileType === "image/svg+xml") {
          extension = "svg";
        } else if (fileType === "image/jpeg") {
          extension = "jpg";
        } else if (fileType === "image/png") {
          extension = "png";
        } else if (fileType === "image/webp") {
          extension = "webp";
        } else if (fileType === "image/gif") {
          extension = "gif";
        }
      } else if (fileName) {
        // Try to get extension from filename
        const parts = fileName.split(".");
        if (parts.length > 1) {
          extension = parts[parts.length - 1].toLowerCase();
          // Map extension to content type
          if (extension === "svg") {
            contentType = "image/svg+xml";
          } else if (extension === "jpg" || extension === "jpeg") {
            contentType = "image/jpeg";
          } else if (extension === "webp") {
            contentType = "image/webp";
          } else if (extension === "gif") {
            contentType = "image/gif";
          }
        }
      }

      const filename = `logo-${Date.now()}.${extension}`;

      // Upload logo to Sanity
      const logoAsset = await this.uploadImage(
        imageData,
        filename,
        contentType
      );

      console.log(`✅ Logo uploaded to Sanity:`, logoAsset._id);

      // Update presentation with new logo
      await (this.client as any)
        .patch(presentationId)
        .set({
          companyLogo: {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: logoAsset._id,
            },
          },
        })
        .commit();

      console.log("✅ Logo updated in presentation");

      // Get the public URL for the logo from the asset
      const logoUrl = logoAsset.url;

      console.log("📸 Logo URL:", logoUrl);

      return logoUrl;
    } catch (error: any) {
      console.error("Failed to upload and update logo:", error.message);
      throw error;
    }
  }

  /**
   * Remove logo from presentation
   */
  async removeLogo(presentationId: string): Promise<void> {
    try {
      console.log(`Removing logo from presentation ${presentationId}...`);

      await (this.client as any)
        .patch(presentationId)
        .unset(["companyLogo"])
        .commit();

      console.log("✅ Logo removed from presentation");
    } catch (error: any) {
      console.error("Failed to remove logo:", error.message);
      throw error;
    }
  }

  /**
   * Update logo mode (light/dark) for the side-by-side logo slide
   */
  async updateLogoMode(
    presentationId: string,
    mode: "light" | "dark"
  ): Promise<void> {
    try {
      console.log(
        `Updating logo slide background theme to ${mode} for presentation ${presentationId}...`
      );

      // Fetch the presentation to get its slides
      const presentation: any = await (this.client as any).getDocument(
        presentationId
      );

      if (!presentation || !presentation.slides) {
        throw new Error("Presentation or slides not found");
      }

      // Find the logo slide (slideType: "title", usually the first slide)
      const logoSlideIndex = presentation.slides.findIndex(
        (slide: any) => slide.slideType === "title"
      );

      if (logoSlideIndex === -1) {
        console.log("No logo slide found");
        return;
      }

      const logoSlide = presentation.slides[logoSlideIndex];

      // Default NO OFFENCE logos based on theme
      const defaultLogos = {
        dark: {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: "image-9b1a738f74f7798549443517d29005ec4d33b9ae-820x288-png",
          },
        },
        light: {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: "image-26c0035f2367640a5fdd75be8c36de33c3cbb298-820x288-svg",
          },
        },
      };

      // Check if there's a custom leftLogoImage uploaded
      // If the current leftLogoImage matches one of the default logos, we can update it
      // If it's a custom logo, preserve it
      const currentLogoRef = logoSlide.leftLogoImage?.asset?._ref;
      const hasCustomLogo =
        currentLogoRef &&
        currentLogoRef !== defaultLogos.dark.asset._ref &&
        currentLogoRef !== defaultLogos.light.asset._ref;

      // Update the backgroundTheme and leftLogoImage fields on the logo slide
      const updatedSlides = presentation.slides.map(
        (slide: any, index: number) => {
          if (index === logoSlideIndex) {
            const updatedSlide: any = {
              ...slide,
              backgroundTheme: mode,
            };

            // Only update the left logo if there's no custom logo
            if (!hasCustomLogo) {
              updatedSlide.leftLogoImage = defaultLogos[mode];
              console.log(
                `Setting default ${mode} theme logo (${defaultLogos[mode].asset._ref})`
              );
            } else {
              console.log(`Preserving custom logo (${currentLogoRef})`);
            }

            return updatedSlide;
          }
          return slide;
        }
      );

      // Patch the presentation with the updated slides array
      await (this.client as any)
        .patch(presentationId)
        .set({ slides: updatedSlides })
        .commit();

      console.log(`✅ Logo slide background theme updated to ${mode}`);
    } catch (error: any) {
      console.error(
        "Failed to update logo slide background theme:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Delete a Sanity presentation and all associated images
   */
  async deletePresentation(presentationId: string): Promise<void> {
    try {
      console.log(`Deleting Sanity presentation ${presentationId}...`);

      // First, get the presentation to find all image references
      const presentation: any = await (this.client as any).getDocument(
        presentationId
      );

      const imageRefs = new Set<string>();

      if (presentation) {
        // Extract all image asset references from slides
        if (presentation.slides) {
          presentation.slides.forEach((slide: any) => {
            // Check various image fields
            if (slide.mainVisual?.asset?._ref) {
              imageRefs.add(slide.mainVisual.asset._ref);
            }
            if (slide.leftLogoImage?.asset?._ref) {
              imageRefs.add(slide.leftLogoImage.asset._ref);
            }
            if (slide.beforeImage?.asset?._ref) {
              imageRefs.add(slide.beforeImage.asset._ref);
            }
            if (slide.afterImage?.asset?._ref) {
              imageRefs.add(slide.afterImage.asset._ref);
            }
            // Check imageLayout fields (A, C, D, E)
            if (slide.imageLayoutA?.asset?._ref) {
              imageRefs.add(slide.imageLayoutA.asset._ref);
            }
            if (slide.imageLayoutC?.asset?._ref) {
              imageRefs.add(slide.imageLayoutC.asset._ref);
            }
            if (slide.imageLayoutD?.asset?._ref) {
              imageRefs.add(slide.imageLayoutD.asset._ref);
            }
            if (slide.imageLayoutE?.asset?._ref) {
              imageRefs.add(slide.imageLayoutE.asset._ref);
            }
            // Check desktop/mobile images
            if (slide.desktopImage?.asset?._ref) {
              imageRefs.add(slide.desktopImage.asset._ref);
            }
            if (slide.mobileImage?.asset?._ref) {
              imageRefs.add(slide.mobileImage.asset._ref);
            }
            if (slide.images && Array.isArray(slide.images)) {
              slide.images.forEach((img: any) => {
                if (img.asset?._ref) {
                  imageRefs.add(img.asset._ref);
                }
              });
            }
          });
        }

        // Check presentation-level logo
        if (presentation.customerLogo?.asset?._ref) {
          imageRefs.add(presentation.customerLogo.asset._ref);
        }
      }

      // Delete the presentation document FIRST to remove references
      await (this.client as any).delete(presentationId);
      console.log(`✅ Deleted presentation document: ${presentationId}`);

      // Now delete all image assets (no longer referenced)
      if (imageRefs.size > 0) {
        console.log(`Deleting ${imageRefs.size} image assets...`);
        for (const imageRef of imageRefs) {
          try {
            await (this.client as any).delete(imageRef);
            console.log(`✅ Deleted image: ${imageRef}`);
          } catch (err: any) {
            console.warn(`⚠️ Failed to delete image ${imageRef}:`, err.message);
          }
        }
      }

      console.log("✅ Sanity presentation and images deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete Sanity presentation:", error.message);
      throw error;
    }
  }
}
