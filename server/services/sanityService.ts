import { createClient, SanityClient } from "@sanity/client";

interface SanityPresentationInput {
  customerName: string;
  description?: string;
  beforeDesktopBase64: string;
  beforeMobileBase64: string;
  industry?: string;
  website?: string;
}

export class SanityService {
  private client: SanityClient;

  constructor(projectId: string, dataset: string, token: string) {
    this.client = createClient({
      projectId,
      dataset,
      token,
      apiVersion: "2024-01-01",
      useCdn: false,
    });
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
  private async uploadImage(base64Data: string, filename: string) {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, "base64");

      // Upload to Sanity
      const asset = await this.client.assets.upload("image", buffer, {
        filename,
        contentType: "image/png",
      });

      console.log(`✅ Uploaded ${filename} to Sanity:`, asset._id);
      return asset;
    } catch (error: any) {
      console.error(`Failed to upload ${filename} to Sanity:`, error.message);
      throw error;
    }
  }

  /**
   * Create a new presentation in Sanity with before images
   */
  async createPresentation(input: SanityPresentationInput): Promise<string> {
    try {
      console.log("\n=== Creating Sanity Presentation ===");
      console.log("Customer:", input.customerName);

      // Upload the before images
      console.log("Uploading before images...");
      const beforeDesktopAsset = await this.uploadImage(
        input.beforeDesktopBase64,
        `before-desktop-${Date.now()}.png`
      );

      const beforeMobileAsset = await this.uploadImage(
        input.beforeMobileBase64,
        `before-mobile-${Date.now()}.png`
      );

      // Generate slug from company name
      const companySlug = this.createSlug(input.customerName);
      // Generate a random unique ID
      const uniqueId = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Create the presentation document
      const industryType = this.mapIndustryType(input.industry);
      console.log("Creating presentation document...");
      console.log(
        "Industry:",
        input.industry,
        "→ Industry Type:",
        industryType
      );
      const newPresentation = await this.client.create({
        _type: "presentation",
        customerName: input.customerName,
        companySlug,
        uniqueId,
        description:
          input.description || `Presentation for ${input.customerName}`,
        industryType,
        isPublished: false,
        slides: [
          // 1. Logo slide
          {
            _type: "slide",
            _key: "slide-1",
            title: "Logo slide",
            slideType: "title",
            backgroundTheme: "dark",
            transition: "slide",
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
          // 3. Agenda
          {
            _type: "slide",
            _key: "slide-3",
            title: "Agenda",
            slideType: "agenda",
            heading: "Agenda",
            backgroundTheme: "dark",
            transition: "slide",
            agendaItems: [
              { label: "Intro" },
              { label: "Bakgrunn" },
              { label: "Proposal" },
              { label: "Q&A" },
            ],
          },
          // 4. Om oss
          {
            _type: "slide",
            _key: "slide-4",
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
          // 5. Hva vi gjør
          {
            _type: "slide",
            _key: "slide-5",
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
          // 6. Statement
          {
            _type: "slide",
            _key: "slide-6",
            title: "Statement",
            slideType: "statement",
            heading: "Vårt oppdrag",
            statementText:
              "Vi er et team som drives av kreativ presisjon og et ønske om å løfte merkevarer—med mål om å skape klare uttrykk, sterke opplevelser og løsninger som faktisk gjør en forskjell.",
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 7. Prinsipper
          {
            _type: "slide",
            _key: "slide-7",
            title: "Prinsipper",
            slideType: "principles",
            heading: "Prinsipper",
            backgroundTheme: "light",
            transition: "slide",
            principleItems: [
              {
                number: "1",
                title: "Klarhet først",
                description:
                  "Vi bygger alltid med tydelighet i sentrum — enten det gjelder brand, nettside eller film. Alt vi lager skal være forståelig, intuitivt og lett å ta inn.",
              },
              {
                number: "2",
                title: "Kvalitet",
                description:
                  "Vi jobber tett på detaljer, både kreativt og teknisk. Hvert bilde, hvert ord og hver linje kode skal bidra til helheten og løfte prosjektet.",
              },
              {
                number: "3",
                title: "Fine opplevelser",
                description:
                  "Vi designer ikke bare for å se bra ut. Vi designer for å skape følelser, engasjement og merkevaredybde — løsninger brukere faktisk husker.",
              },
              {
                number: "4",
                title: "Samarbeid i kjernen",
                description:
                  "Vi bygger prosjekter sammen med kunden, ikke for dem. Åpen kommunikasjon, korte beslutningsveier og løpende justeringer gjør resultatet bedre.",
              },
            ],
          },
          // 8. Prosess
          {
            _type: "slide",
            _key: "slide-8",
            title: "Prosess",
            slideType: "process",
            heading: "Prosess",
            backgroundTheme: "light",
            transition: "slide",
            processItems: [
              {
                number: "1",
                title: "Oppstart & innsikt",
                description:
                  "Vi starter med å forstå merkevaren, behovene og målene deres. Vi kartlegger målgruppe, utfordringer og ønsket retning slik at prosjektet får en tydelig og riktig ramme fra første dag.",
              },
              {
                number: "2",
                title: "Strategi & konsept",
                description:
                  "Vi utvikler en klar strategi og et kreativt konsept basert på innsikten. Her definerer vi stil, tone, budskap, funksjonalitet, og hvordan prosjektet skal skape verdi for dere og kundene deres.",
              },
              {
                number: "3",
                title: "Produksjon",
                description:
                  "Vi bygger ut helheten visuelt og teknisk: design, film, foto, innhold og digitale løsninger. Alt utvikles med fokus på kvalitet, opplevelse og presisjon — i tett dialog med dere.",
              },
              {
                number: "4",
                title: "Optimalisering",
                description:
                  "Når leveransen er på plass, sørger vi for implementering, testing og finpuss. Vi tilpasser etter behov, sikrer at alt fungerer sømløst, og legger grunnlaget for videre vekst og utvikling.",
              },
            ],
          },
          // 9. Fullskjerm bilde
          {
            _type: "slide",
            _key: "slide-9",
            title: "Fullskjerm bilde",
            slideType: "fullScreenVisual",
            mediaType: "image",
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 10. Før & etter (with uploaded images)
          {
            _type: "slide",
            _key: "slide-10",
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
          // 11. Bildeoppsett
          {
            _type: "slide",
            _key: "slide-11",
            title: "Bildeoppsett",
            slideType: "imageLayout",
            heading: "Rebrand",
            subheading: "",
            backgroundTheme: "dark",
            transition: "slide",
          },
          // 12. Fullskjerm video
          {
            _type: "slide",
            _key: "slide-12",
            title: "Fullskjerm video",
            slideType: "fullScreenVisual",
            mediaType: "video",
            backgroundTheme: "light",
            transition: "slide",
          },
          // 13. Klienter (with default logos)
          {
            _type: "slide",
            _key: "slide-13",
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
          // 14. Tusen takk
          {
            _type: "slide",
            _key: "slide-14",
            title: "Tusen takk",
            slideType: "fullsizeTitle",
            heading: "Tusen",
            subheading: "takk",
            backgroundTheme: "dark",
            transition: "slide",
          },
        ],
      });

      console.log("✅ Sanity presentation created:", newPresentation._id);
      console.log("📍 Unique ID:", uniqueId);

      return newPresentation._id;
    } catch (error: any) {
      console.error("Failed to create Sanity presentation:", error.message);
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
      const presentation = await this.client.getDocument(presentationId);

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
      await this.client
        .patch(presentationId)
        .set({ slides: updatedSlides })
        .commit();

      console.log("✅ Sanity presentation updated with after images");
    } catch (error: any) {
      console.error("Failed to update Sanity presentation:", error.message);
      throw error;
    }
  }
}
