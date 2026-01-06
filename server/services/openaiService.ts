import OpenAI from "openai";

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  seo: number;
}

export class OpenAIService {
  private client: OpenAI | null = null;

  private getPreferredWebSearchModels(availableModels: string[]): string[] {
    // Prefer explicit search-preview models first, then fall back to standard models.
    // Some accounts (or recent API changes) can return 404 for previously valid
    // *-search-preview model IDs, so we must be able to fall through.
    const preferred = [
      "gpt-4o-mini-search-preview",
      "gpt-4o-search-preview",
      // Fallbacks that may still support the web_search tool on Responses API
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "gpt-4-turbo",
    ];

    const fromAvailable = preferred.filter((m) => availableModels.includes(m));
    const remaining = preferred.filter((m) => !fromAvailable.includes(m));

    // Also include any other available models containing "search" as a last resort.
    const otherSearch = availableModels
      .filter((m) => m.includes("search") && !fromAvailable.includes(m))
      .sort();

    return [...fromAvailable, ...remaining, ...otherSearch];
  }

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }
    try {
      const res = await this.client.models.list();
      return res.data.map((m) => m.id).sort();
    } catch (error: any) {
      console.error("Failed to list models:", error.message);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      // Make a minimal test request
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });

      return !!response.id;
    } catch (error: any) {
      console.error("OpenAI test failed:", error.message);
      throw new Error("Invalid OpenAI API key or connection failed");
    }
  }

  async generateEmail(
    companyName: string,
    contactPerson: string,
    service: string,
    websiteUrl: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const serviceDescriptions: Record<string, string> = {
      Video: "commercial videos and professional video content",
      Images: "professional photography, portraits and visual content",
      Web: "new or improved website with modern design",
      Branding: "visual identity, brand book and design system",
    };

    const prompt = `Skriv en kort, personlig utreach-e-post på norsk til ${
      contactPerson || "kontaktpersonen"
    } hos ${companyName} om ${serviceDescriptions[service] || service}.

Avsender-kontekst (kun for forståelse, IKKE skriv dette i e-posten):
- Selskap: No Offence
- Person: Martin Fjeld

Hilsen: "${contactPerson ? `Hei ${contactPerson.split(" ")[0]},` : "Hei,"}"

Maks 150 ord. Start med en setning om hvorfor jeg tar kontakt. Inkluder call-to-action for et kort møte.

Nettside: ${websiteUrl}

AVSLUTNING (OBLIGATORISK):
- E-posten skal ende med nøyaktig denne linjen og INGENTING etterpå:
Med vennlig hilsen,
- IKKE legg til navn, firma, signatur, telefon, tittel eller annen tekst etter dette.
- IKKE skriv "Martin Fjeld" eller "No Offence" i bunn eller som signatur.

SPRÅKREGEL (VIKTIG):
- Hvis du nevner avsender + selskap i brødteksten, bruk riktig formulering:
  "Jeg heter Martin Fjeld og jobber i et kreativt design- og digitalbyrå kalt No Offence."
- IKKE skriv "jobber med No Offence".

KRITISKE SKRIVEREGLER:
→ Bruk enkelt språk - korte, klare setninger
→ UNNGÅ AI-klisjéer som "dykke ned i," "låse opp," "game-changing," "banebrytende", "Jeg håper dette meldingen finner deg vel"
→ Vær direkt og konsis - kutt ekstra ord
→ Naturlig tone - skriv som folk faktisk snakker. Det er greit å starte med "og" eller "men"
→ IKKE markedsføringsspråk - ingen hype, ingen overdrivelser
→ Vær ærlig - ikke falsk vennlighet eller overpromise
→ Forenklet grammatikk - casual grammatikk er ok hvis det føles mer menneskelig
→ Kutt tøv - hopp over ekstra adjektiver eller fyllordet
→ Fokuser på klarhet - gjør det enkelt å forstå

STRENGT FORBUDT:
→ IKKE bruk tankestreker ( - )
→ IKKE bruk lister eller "X og også Y"
→ IKKE bruk kolon ( : ) 
→ UNNGÅ retoriske spørsmål som "Har du noen gang lurt på…?"
→ INGEN falske engasjementfraser som "La oss ta en titt," "Bli med på reisen"

Skriv kun e-posten på norsk, ingen forklaring:`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "Du er en writing assistant trent i flere tiår til å skrive i en klar, naturlig og ærlig tone. Du skriver korte, personlige e-poster på norsk som høres menneskelige ut, ikke robotaktige eller promoterende.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.error("OpenAI generation failed:", error.message);
      throw new Error("Failed to generate email content");
    }
  }

  async generateLighthouseSummary(scores: LighthouseScores): Promise<string> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `Skriv et kort sammendrag på NORSK om denne nettsiden basert på Lighthouse-resultater. MAKS 100 tegn.

Resultater:
- SEO: ${scores.seo}%
- Tilgjengelighet: ${scores.accessibility}%
- Ytelse: ${scores.performance}%

VIKTIG: Skriv for folk som ikke kan noe om nettsider. Bruk enkelt språk og forklar hva det betyr i praksis.

TONE: Vær positiv og konstruktiv. Ikke vær for skarp når du påpeker svakheter. Bruk mykere ord som "litt", "fortsatt", "kunne vært" osv.

STRUKTUR: "Dere har [bra/god] [område], men [område] er fortsatt litt [svakhet]. Vi kan hjelpe med å [forbedre]."

Eksempler:
- "Dere har god synlighet i søk, men ytelsen er fortsatt litt treg. Vi kan hjelpe med å gjøre siden raskere"
- "Siden er rask og fungerer bra, men SEO kunne vært bedre. Vi kan hjelpe med å øke synligheten"
- "Bra hastighet, men tilgjengelighet mangler litt. Vi kan gjøre siden mer brukervennlig for alle"
- "Utmerket på de fleste områder, men det er alltid rom for forbedring. Vi kan optimalisere ytterligere"

KRITISKE SKRIVEREGLER:
→ Bruk enkelt språk - korte, klare setninger
→ UNNGÅ AI-klisjéer som "dykke ned i," "låse opp," "game-changing," "banebrytende"
→ Vær direkt og konsis - kutt ekstra ord
→ Naturlig tone - skriv som folk faktisk snakker
→ IKKE markedsføringsspråk - ingen hype, ingen overdrivelser
→ Vær ærlig - ikke falsk vennlighet eller overpromise
→ Forenklet grammatikk - casual grammatikk er ok hvis det føles mer menneskelig
→ Kutt tøv - hopp over ekstra adjektiver eller fyllord
→ Fokuser på klarhet - gjør det enkelt å forstå

STRENGT FORBUDT:
→ IKKE bruk tankestreker ( - )
→ IKKE bruk lister eller "X og også Y"
→ IKKE bruk kolon ( : ) 
→ UNNGÅ retoriske spørsmål som "Har du noen gang lurt på…?"
→ INGEN falske engasjementfraser som "La oss ta en titt," "Bli med på reisen"

VIKTIG: 
- Avslutt med hvordan vi kan hjelpe
- Vær myk og konstruktiv, ikke skarp
- Bruk ord som "litt", "fortsatt", "kunne" for å tone ned kritikk

Skriv KUN sammendraget, ingen forklaring, ingen JSON, bare teksten.`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You generate concise, professional descriptions in Norwegian.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      return content || "Nettsiden fungerer";
    } catch (error: any) {
      console.error("Failed to generate Lighthouse summary:", error.message);
      // Return fallback summary
      const avgScore = Math.round(
        (scores.seo + scores.accessibility + scores.performance) / 3
      );

      // Find worst performing area
      const worst =
        scores.seo < scores.accessibility
          ? scores.seo < scores.performance
            ? "SEO"
            : "ytelsen"
          : scores.accessibility < scores.performance
          ? "tilgjengeligheten"
          : "ytelsen";

      if (avgScore >= 85) {
        return "Solid nettside med god ytelse. Vi kan hjelpe med å optimalisere ytterligere";
      } else if (avgScore >= 60) {
        return `Fungerer godt, men ${worst} kunne vært bedre. Vi kan hjelpe med å forbedre dette`;
      } else {
        return `${worst} trenger litt oppgradering fortsatt. Vi kan hjelpe med å løfte kvaliteten`;
      }
    }
  }

  async extractContactDetails(
    contactPersonName: string,
    websiteContent: string,
    companyName: string
  ): Promise<{ email: string; phone: string }> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `You are an expert at finding specific contact information for individuals on company websites.

COMPANY: ${companyName}
TARGET PERSON: ${contactPersonName}

WEBSITE CONTENT (includes main page, about page, contact page, team page):
${websiteContent.substring(0, 12000)}

CRITICAL TASK:
Find the PERSONAL/DIRECT contact information specifically for ${contactPersonName}. 

WHAT TO LOOK FOR:
1. Personal email: Look for patterns like:
   - firstname@company.com
   - firstname.lastname@company.com  
   - initials@company.com
   - Any email that appears next to their name
   - NOT generic emails like post@, info@, kontakt@, firmapost@

2. Direct phone number: Look for:
   - Mobile/cell phone listed with their name
   - Direct line number (not main switchboard)
   - Any phone number appearing next to their name or title
   - Format: +47 followed by 8 digits, or just 8 digits

CRITICAL PHONE RULE (NORWAY):
- Prefer mobile numbers. In Norway, mobile numbers typically start with 4 or 9 (8 digits; +47 optional).
- If you only find switchboard/landline numbers (often starting with 2/3/5/6/7/8), return empty string for "phone".

WHERE TO SEARCH:
- Team/staff listings (ansatte, vårt team, medarbeidere)
- Management/leadership sections (ledelse, daglig leder)
- Contact pages with individual listings
- About us sections with staff details
- Bio/profile sections
- Any text immediately surrounding "${contactPersonName}"

IMPORTANT:
- Return empty string if you can only find generic company contact info, not personal info for ${contactPersonName}.
- Do NOT guess. Only return email/phone that appears verbatim in WEBSITE CONTENT.

Return ONLY this JSON format (no markdown, no extra text):
{
  "email": "personal email for ${contactPersonName} or empty string",
  "phone": "direct phone for ${contactPersonName} or empty string"
}`;

    try {
      console.log(
        `Sending ${
          websiteContent.substring(0, 12000).length
        } chars to OpenAI for ${contactPersonName}...`
      );

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at finding specific individuals' contact information on websites. You analyze team pages, contact sections, and staff listings to find personal email addresses and direct phone numbers. You NEVER return generic company emails - only personal contact info for the named individual. Always return valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 400,
      });

      console.log("OpenAI response received");

      const content = response.choices[0]?.message?.content || "{}";

      console.log("OpenAI raw response:", content);

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);

        const rawEmail = (result.email || "").trim();
        const rawPhone = (result.phone || "").trim();

        // Verify returned values exist in the provided content to prevent hallucinations.
        const contentLower = websiteContent.toLowerCase();
        const email =
          rawEmail && contentLower.includes(rawEmail.toLowerCase())
            ? rawEmail
            : "";

        const digitsOnly = (s: string) => s.replace(/\D/g, "");
        const contentDigits = digitsOnly(websiteContent);
        const phoneDigits = digitsOnly(rawPhone);

        const last8 =
          phoneDigits.length >= 8 ? phoneDigits.slice(-8) : phoneDigits;
        const isNorwegianMobile =
          last8.length === 8 &&
          (last8.startsWith("4") || last8.startsWith("9"));

        const phone =
          phoneDigits &&
          contentDigits.includes(phoneDigits) &&
          isNorwegianMobile
            ? rawPhone
            : "";

        return { email, phone };
      }

      return { email: "", phone: "" };
    } catch (error: any) {
      console.error("OpenAI contact extraction failed:", error.message);
      return { email: "", phone: "" };
    }
  }

  async searchPersonContactPageCandidates(
    personName: string,
    companyWebsite: string,
    companyName: string
  ): Promise<Array<{ url: string; reason: string; sourceUrls: string[] }>> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    let siteHost = "";
    try {
      siteHost = new URL(companyWebsite).host.replace(/^www\./i, "");
    } catch {
      siteHost = companyWebsite.replace(/^https?:\/\//i, "").split("/")[0];
      siteHost = siteHost.replace(/^www\./i, "");
    }

    const prompt = `Finn sider på OFFISIELL nettside som sannsynligvis inneholder direkte kontaktinfo for en person.

Selskap: "${companyName}"
Person: "${personName}"
Verifisert nettside: "${companyWebsite}"
Domene (bruk for site:-søk): "${siteHost}"

KRITISK:
- Ikke finn på URLer. Returner kun URLer du faktisk finner i søkeresultater.
- URLene må være på samme domene som nettsiden (samme nettsted).
- Prioriter sider som ofte har direkte kontaktinfo: /ansatte, /team, /kontakt, /om-oss, /people, /person, /profil.

Gjør konkrete søk som:
- site:${siteHost} "${personName}" epost
- site:${siteHost} "${personName}" telefon
- site:${siteHost} "${personName}" kontakt
- site:${siteHost} "${personName}" advokat
- "${companyName}" "${personName}" kontakt

Svar kun i JSON (ingen markdown):
{
  "candidates": [
    {
      "url": "https://...",
      "reason": "kort begrunnelse",
      "sourceUrls": ["https://...", "https://..."]
    }
  ]
}

Hvis du ikke finner noe sikkert: {"candidates": []}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-search-preview",
        web_search_options: {},
        messages: [{ role: "user", content: prompt }],
      } as any);

      const raw = completion.choices[0]?.message?.content?.trim() || "";

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const candidates = Array.isArray(parsed.candidates)
            ? parsed.candidates
            : [];

          const fromJson = candidates
            .map((c: any) => ({
              url: typeof c.url === "string" ? c.url : "",
              reason: typeof c.reason === "string" ? c.reason : "",
              sourceUrls: Array.isArray(c.sourceUrls)
                ? c.sourceUrls.filter((u: any) => typeof u === "string")
                : [],
            }))
            .filter((c: any) => c.url);

          if (fromJson.length > 0) return fromJson.slice(0, 5);
        } catch {
          // fall through
        }
      }

      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`]+/g;
      const urls = Array.from(
        new Set(
          (raw.match(urlRegex) || []).map((u) => u.replace(/[),.;]+$/g, ""))
        )
      );

      return urls
        .slice(0, 5)
        .map((url) => ({ url, reason: "", sourceUrls: [] }));
    } catch (error: any) {
      console.error(
        "AI person contact page candidate search failed:",
        error.message
      );
      return [];
    }
  }

  async findContactPerson(
    websiteContent: string,
    companyName: string
  ): Promise<{ name: string; email: string; phone: string; title: string }> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `You are an expert at finding key contact people at companies. Analyze the following content from ${companyName}'s website.

Website content:
${websiteContent.substring(0, 8000)}

Task:
Find the most appropriate contact person for a business pitch. Look for:
- "Daglig leder" (Managing Director/CEO)
- "Administrerende direktør" (CEO)
- "Styrets leder" (Chairman of the Board) 
- "Eier" (Owner)
- "Gründer" (Founder)
- CEO, Managing Director, Owner, Founder

Priority order: Daglig leder > CEO > Owner/Founder > Chairman

Find their:
1. Full name
2. Title/position
3. Direct email address (personal, not general company email)
4. Direct phone number

Return the result in the following JSON format (only JSON, no extra text):
{
  "name": "full name if found, otherwise empty string",
  "title": "their title/position if found, otherwise empty string",
  "email": "their personal email if found, otherwise empty string",
  "phone": "their phone number if found, otherwise empty string"
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at identifying key decision makers at companies and extracting their contact details. Always return valid JSON. Prioritize finding the CEO/Managing Director (Daglig leder) as they are the best contact for business pitches.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });

      const content = response.choices[0]?.message?.content || "{}";

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          name: result.name || "",
          title: result.title || "",
          email: result.email || "",
          phone: result.phone || "",
        };
      }

      return { name: "", title: "", email: "", phone: "" };
    } catch (error: any) {
      console.error("OpenAI contact person finding failed:", error.message);
      return { name: "", title: "", email: "", phone: "" };
    }
  }

  async searchCompanyWebsiteCandidates(
    companyName: string,
    contactPerson?: string
  ): Promise<Array<{ url: string; reason: string; sourceUrls: string[] }>> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `Du skal finne OFFISIELL nettside for et norsk selskap ved å søke på web.

Selskap: "${companyName}"
Kontaktperson (hvis kjent): "${contactPerson || ""}"

Gjør konkrete søk som:
- "${companyName}" nettside
- "${companyName}" kontakt
- "${companyName}" "${contactPerson || ""}" 

KRITISK - OFFISIELLE NETTSIDER KUN:
- Ikke finn på URLer. Du må bare returnere URLer du faktisk finner i søkeresultater.
- BARE returner OFFISIELLE FIRMANETTSIDER - domenet må tilhøre selskapet selv
- ALDRI returner:
  * Firmakataloger/lister (firmalisten.no, firmakatalogen.no, gulesider.no, 1881.no, telefonkatalogen.no, kvasir.no, dinsida.no)
  * Registre (proff.no, brreg.no, forvalt.no, enento.no, bedriftsdatabasen.no)
  * Nyhetsartikler (aftenposten.no, vg.no, nrk.no, tv2.no, dn.no, e24.no, etc.)
  * Artikler OM selskapet/personen på tredjepartssider
  * Intervjuer, pressemeldinger, eller nyhetsoppslag
  * Sosiale medier (Facebook, LinkedIn, Instagram, Twitter)
  * Forum, blogger, eller innlegg
  * Wikipedia eller lignende
  * URLer med organisasjonsnummer (f.eks. /930978981)
  * URLer med UTM-parametre (utm_source, utm_medium, etc.)
- VELG: Det domenet som mest sannsynlig tilhører firmaet direkte (f.eks. fribevegelse.no for "Fri Bevegelse")
- Returner opptil 5 kandidater, rangert med mest sannsynlige offisielle nettsider først

Svar kun i JSON på dette formatet (ingen markdown):
{
  "candidates": [
    {
      "url": "https://...",
      "reason": "kort begrunnelse",
      "sourceUrls": ["https://...", "https://..."]
    }
  ]
}

Hvis du ikke finner noe sikkert: {"candidates": []}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-search-preview",
        web_search_options: {},
        messages: [{ role: "user", content: prompt }],
      } as any);

      const raw = completion.choices[0]?.message?.content?.trim() || "";

      // Helper function to check if URL is not an official company website
      const isInvalidWebsite = (url: string): boolean => {
        const lowerUrl = url.toLowerCase();

        // Company directories, registries, and listing sites
        const directorySites = [
          "proff.no",
          "brreg.no",
          "forvalt.no",
          "enento",
          "firmalisten.no",
          "firmakatalogen.no",
          "telefonkatalogen.no",
          "gulesider.no",
          "telefonbok.no",
          "1881.no",
          "kvasir.no",
          "dinsida.no",
          "allkunner.no",
          "bedriftsdatabasen.no",
          "facebook.com",
          "linkedin.com",
          "twitter.com",
          "instagram.com",
        ];

        // News/media sites
        const newsSites = [
          "aftenposten.no",
          "vg.no",
          "dagbladet.no",
          "nrk.no",
          "tv2.no",
          "dn.no",
          "adressa.no",
          "bt.no",
          "ba.no",
          "nettavisen.no",
          "abc.no",
          "abcnyheter.no",
          "e24.no",
          "finansavisen.no",
        ];

        // Check for article patterns in URL path
        const articlePatterns = [
          "/artikkel/",
          "/article/",
          "/nyheter/",
          "/news/",
          "/intervju/",
          "/interview/",
          "/om-oss/",
          "/about/",
          "/blog/",
          "/blogg/",
          "/post/",
          "/innlegg/",
          "/pressemeldinger/",
          "/presse/",
          "/press-release/",
        ];

        // Check for date patterns (articles often have dates in URL)
        const hasDatePattern =
          /\/\d{4}\/\d{2}\/\d{2}\//i.test(url) ||
          /\/\d{4}-\d{2}-\d{2}\//i.test(url);

        // Check for organization numbers (9 digits) - typical in directory URLs
        const hasOrgNumber = /\/\d{9}/.test(url);

        // Check for utm_source parameter (often from search result aggregators)
        const hasUtmSource = lowerUrl.includes("utm_source=");

        return (
          directorySites.some((site) => lowerUrl.includes(site)) ||
          newsSites.some((site) => lowerUrl.includes(site)) ||
          articlePatterns.some((pattern) => lowerUrl.includes(pattern)) ||
          hasDatePattern ||
          hasOrgNumber ||
          hasUtmSource
        );
      };

      // Preferred: parse JSON response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const candidates = Array.isArray(parsed.candidates)
            ? parsed.candidates
            : [];

          const fromJson = candidates
            .map((c: any) => ({
              url: typeof c.url === "string" ? c.url : "",
              reason: typeof c.reason === "string" ? c.reason : "",
              sourceUrls: Array.isArray(c.sourceUrls)
                ? c.sourceUrls.filter((u: any) => typeof u === "string")
                : [],
            }))
            .filter((c: any) => c.url)
            .filter((c: any) => {
              // Filter out invalid URLs (articles, directories, etc.)
              if (isInvalidWebsite(c.url)) {
                console.log(`⚠️ Filtered out invalid URL: ${c.url}`);
                return false;
              }
              return true;
            });

          if (fromJson.length > 0) return fromJson;
        } catch {
          // fall through to URL extraction
        }
      }

      // Fallback: extract URLs from whatever the model returned
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`]+/g;
      const urls = Array.from(
        new Set(
          (raw.match(urlRegex) || []).map((u) => u.replace(/[),.;]+$/g, ""))
        )
      ).filter((url) => !isInvalidWebsite(url));

      return urls
        .slice(0, 5)
        .map((url) => ({ url, reason: "", sourceUrls: [] }));
    } catch (error: any) {
      console.error("AI website candidate search failed:", error.message);
      return [];
    }
  }
  async searchPersonContactPage(
    personName: string,
    companyWebsite: string,
    companyName: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `Search the web to find the specific page on ${companyWebsite} that contains contact information for ${personName} at ${companyName}.

Task: Find the exact URL of the page (contact page, about page, team page, or profile page) where ${personName}'s direct contact information (email, phone number) is likely displayed.

Search query suggestions:
- "site:${companyWebsite} ${personName} contact email"
- "site:${companyWebsite} ${personName} phone"
- "${companyName} ${personName} kontakt"

Requirements:
- Return only the most relevant page URL where their contact info is likely found
- Must be a page on ${companyWebsite} domain
- Prioritize: contact pages, team pages, about pages, or individual profile pages
- If you cannot find a specific page with high confidence, return "NOT_FOUND"

Person: ${personName}
Company: ${companyName}
Website: ${companyWebsite}`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a web search expert specialized in finding contact pages and profile pages for specific individuals at companies. Return only the URL or NOT_FOUND.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";

      // Clean up the response
      const urlMatch = content.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
      if (urlMatch) {
        return urlMatch[0];
      }

      if (content === "NOT_FOUND" || !content.includes("http")) {
        return "";
      }

      return content;
    } catch (error: any) {
      console.error("OpenAI person contact page search failed:", error.message);
      return "";
    }
  }

  async enrichCompanyInfoWithWebSearch(
    proffUrl: string,
    companyName: string,
    contactPerson: string,
    website: string
  ): Promise<{
    selskap: string;
    navn: string;
    kundeEpost: string;
    telefon: string;
    bransje: string;
  }> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const prompt = `Analyser BARE Proff.no-siden (${proffUrl}) og firmets OFFISIELLE nettside for å finne informasjon:

KRITISKE REGLER - LES NØYE:
1. Daglig leder/CEO: Hent KUN fra "Offisiell foretaksinformasjon" på Proff.no
2. E-post og telefon: Hent KUN fra firmets offisielle nettside${
      website ? ` (${website})` : ""
    }
3. ALDRI bruk informasjon fra:
   - Nyhetsartikler (aftenposten.no, vg.no, etc.)
   - Pressemeldinger
   - LinkedIn-poster
   - Tredjepartsider
   - Meninger/debatter
   - Intervjuer eller artikler OM personen/firmaet

BRANSJE: Basert på Proff.no-URLen og firmanavnet "${companyName}":
- Inneholder "helse", "aktivitet", "fitness", "trening" → "helse"
- Inneholder "bygg", "entreprenør", "anlegg", "tak" → "bygg"
- Inneholder "advokat", "juridisk", "jus" → "advokat"
- Ellers: kort beskrivende ord

VALIDERING:
- E-post MÅ være på firmets domene (IKKE @aftenposten.no, @vg.no, etc.)
- Hvis du finner kontaktinfo fra nyhetsartikler eller media → IGNORER DEN
- Hvis ingen offisiell e-post finnes → la feltet være tomt

Svar kun i JSON:
{
  "selskap": "",
  "navn": "",
  "kundeEpost": "",
  "telefon": "",
  "bransje": ""
}}`;

    try {
      console.log(
        "Starting AI web search enrichment with gpt-4o-search-preview..."
      );

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-search-preview",
        web_search_options: {},
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      } as any); // Type assertion needed for web_search_options

      const raw = completion.choices[0]?.message?.content?.trim() || "";
      console.log("AI web search raw response:", raw);

      // Parse JSON response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);

        // Validate email - reject if from news/media sites
        const blockedDomains = [
          "aftenposten.no",
          "vg.no",
          "dagbladet.no",
          "nrk.no",
          "tv2.no",
          "dn.no",
          "adressa.no",
          "bt.no",
          "ba.no",
          "facebook.com",
          "linkedin.com",
          "twitter.com",
          "instagram.com",
        ];

        let validatedEmail = json.kundeEpost || "";
        if (validatedEmail) {
          const emailDomain = validatedEmail.split("@")[1]?.toLowerCase() || "";
          if (blockedDomains.some((blocked) => emailDomain.includes(blocked))) {
            console.log(
              "⚠️ Blocked email from news/media site:",
              validatedEmail
            );
            validatedEmail = "";
          }
        }

        return {
          selskap: json.selskap || "",
          navn: json.navn || "",
          kundeEpost: validatedEmail,
          telefon: json.telefon || "",
          bransje: json.bransje || "",
        };
      }

      return {
        selskap: "",
        navn: "",
        kundeEpost: "",
        telefon: "",
        bransje: "",
      };
    } catch (error: any) {
      console.error("AI web search enrichment failed:", error.message);
      return {
        selskap: "",
        navn: "",
        kundeEpost: "",
        telefon: "",
        bransje: "",
      };
    }
  }

  /**
   * Search for LinkedIn profile of a person
   */
  async searchLinkedInProfile(
    personName: string,
    companyName: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    // Build name variants
    const dashChars = /[-‐‑‒–—]/g;
    const nameVariants = Array.from(
      new Set(
        [
          personName,
          personName.replace(dashChars, " "),
          personName.replace(dashChars, ""),
        ]
          .map((v) => v.trim())
          .filter(Boolean)
      )
    );

    console.log(`\n🔍 Searching LinkedIn for: ${personName}`);
    console.log(`Name variants: ${nameVariants.join(", ")}`);

    // Check available models, but do not assume a model is callable just because it appears
    // in the list. Some model IDs can still 404, so we must try/fallback at runtime.
    const availableModels = await this.listModels();
    const candidateModels = this.getPreferredWebSearchModels(availableModels);

    console.log(
      `🤖 Web-search model candidates: ${candidateModels
        .slice(0, 8)
        .join(", ")}${candidateModels.length > 8 ? ", ..." : ""}`
    );

    // We'll run a few focused web searches (like you do manually: "<name> linkedin")
    // and then extract/rank URLs locally. This avoids relying on the model to follow
    // a long multi-step prompt perfectly.
    const queries: string[] = [];
    for (const v of nameVariants) {
      queries.push(`"${v}" linkedin`);
      queries.push(`site:linkedin.com/in "${v}"`);
      queries.push(`site:linkedin.com/pub "${v}"`);
      if (companyName) queries.push(`"${v}" "${companyName}" linkedin`);
    }
    // De-dup and cap to keep latency/cost reasonable
    const uniqueQueries = Array.from(new Set(queries)).slice(0, 8);

    try {
      const normalizeLinkedInUrl = (inputUrl: string): string => {
        let url = (inputUrl || "").trim();
        if (!url) return "";

        // Trim common trailing punctuation from prose
        url = url.replace(/[),.;]+$/g, "");

        // Ensure scheme
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url.replace(/^\/\//, "")}`;
        }

        // Strip query params + fragments
        url = url.split("?")[0].split("#")[0];

        // Normalize country subdomains to www
        url = url.replace(
          /^https?:\/\/[a-z]{2}\.linkedin\.com\//i,
          "https://www.linkedin.com/"
        );

        // Normalize non-www linkedin.com to www
        url = url.replace(
          /^https?:\/\/(?!www\.)(?:linkedin\.com)\//i,
          "https://www.linkedin.com/"
        );

        // Remove trailing slash
        url = url.replace(/\/$/, "");

        // Only accept profile paths
        const lower = url.toLowerCase();
        if (
          !lower.startsWith("https://www.linkedin.com/in/") &&
          !lower.startsWith("https://www.linkedin.com/pub/")
        ) {
          return "";
        }

        return url;
      };

      const candidateRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:[a-z]{2}\.)?linkedin\.com\/(?:in|pub)\/[\w%\-_.~]+[^\s<>"{}|\\^`)]*/gi;

      const allCandidates: string[] = [];

      // Prefer the Responses API web_search tool when available.
      // Many SDK versions ignore `web_search_options` on chat completions,
      // which makes the model "blind" and it will return nothing.
      const anyClient = this.client as any;
      const canUseResponses =
        typeof anyClient?.responses?.create === "function";

      let workingModel: string | null = null;

      const isModelNotFound = (err: any): boolean => {
        const msg = (err?.message || "").toLowerCase();
        const status = err?.status || err?.statusCode;
        return (
          status === 404 ||
          msg.includes("model not found") ||
          msg.includes("no such model")
        );
      };

      for (const q of uniqueQueries) {
        console.log(`\n🔎 LinkedIn web search query: ${q}`);

        let raw = "";

        if (!canUseResponses) {
          console.log(
            "⚠️ Skipping LinkedIn query (Responses API not available in SDK)"
          );
          continue;
        }

        const modelsToTry: string[] = (
          workingModel ? [workingModel] : candidateModels
        ).filter((m): m is string => typeof m === "string" && m.length > 0);

        let resp: any = null;
        for (const model of modelsToTry) {
          try {
            resp = await anyClient.responses.create({
              model,
              tools: [{ type: "web_search" }],
              input: `Find LinkedIn profile URLs (linkedin.com/in or linkedin.com/pub) for this query: ${q}.\n\nReturn a short list of URLs.`,
            });
            workingModel = model;
            break;
          } catch (searchError: any) {
            if (isModelNotFound(searchError)) {
              console.log(
                `⚠️ Model not found/available: ${model} (${searchError.message})`
              );
              continue;
            }
            console.log(
              `⚠️ LinkedIn search failed with ${model}: ${searchError.message}`
            );
            // Non-404 errors might be transient; try next model anyway.
            continue;
          }
        }

        if (!resp) {
          console.log(
            "⚠️ LinkedIn search failed for all candidate models; skipping query..."
          );
          continue;
        }

        raw = (resp?.output_text || "").trim();

        // Also harvest URLs from citations/annotations if present
        try {
          const output = resp?.output || [];
          for (const item of output) {
            const content = item?.content || [];
            for (const c of content) {
              const annotations = c?.annotations || [];
              for (const a of annotations) {
                const url = a?.url;
                if (typeof url === "string") allCandidates.push(url);
              }
            }
          }
        } catch {
          // ignore
        }

        if (raw) {
          console.log("LinkedIn search raw response:", raw);
          const rawCandidates = raw.match(candidateRegex) || [];
          allCandidates.push(...rawCandidates);
        }
      }

      const candidates = Array.from(
        new Set(allCandidates.map(normalizeLinkedInUrl).filter(Boolean))
      );

      if (candidates.length === 0) {
        console.log("⚠️ No LinkedIn profile found in search results");
        return "";
      }

      if (candidates.length === 1) {
        console.log(`✅ Found LinkedIn profile: ${candidates[0]}`);
        return candidates[0];
      }

      // Tie-breaker: pick the URL whose slug best matches the person's name.
      // If we can't pick confidently, return empty string.
      const tokens = personName
        .replace(dashChars, " ")
        .toLowerCase()
        .replace(/[^a-z0-9æøå\s]/gi, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);

      const scoreCandidate = (url: string): number => {
        const lower = url.toLowerCase();
        const slug =
          lower.split("/in/")[1]?.split("/")[0] ||
          lower.split("/pub/")[1]?.split("/")[0] ||
          "";
        let score = 0;
        for (const t of tokens) {
          if (slug.includes(t)) score += 2;
          else if (lower.includes(t)) score += 1;
        }
        return score;
      };

      const scored = candidates
        .map((url) => ({ url, score: scoreCandidate(url) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      const second = scored[1];
      const hasClearWinner =
        best.score > 0 && best.score > (second?.score ?? -1);

      if (!hasClearWinner) {
        console.log(
          `⚠️ Multiple LinkedIn candidates found but cannot pick confidently: ${candidates.join(
            ", "
          )}`
        );
        return "";
      }

      console.log(`✅ Found LinkedIn profile (best match): ${best.url}`);
      return best.url;
    } catch (error: any) {
      console.error("LinkedIn search failed:", error.message);
      return "";
    }
  }

  async findCompanyLogo(
    companyName: string,
    websiteUrl?: string,
    scrapedCandidates?: Array<{ url: string; source: string; priority: number }>
  ): Promise<{
    logoUrl: string;
    fileFormat: string;
    background: string;
    source: string;
    confidence: "high" | "medium" | "low";
  } | null> {
    if (!scrapedCandidates || scrapedCandidates.length === 0) {
      console.log("⚠️ No candidates provided for logo selection");
      return null;
    }

    // Extract domain from website URL
    const domain = websiteUrl
      ? websiteUrl
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
      : "";

    // Extract company name tokens for matching (avoid legal suffixes and very short tokens)
    const companyTokens = companyName
      .toLowerCase()
      .replace(
        /\b(as|asa|ab|ba|sa|holding|group|konsern|stiftelse|forening)\b/gi,
        " "
      )
      .replace(/[^a-zæøå0-9\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    const companySlug = companyName
      .toLowerCase()
      .replace(/\b(as|asa|ab|ba|sa)\b/gi, " ")
      .replace(/[^a-z0-9æøå\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    console.log(`\n🎯 Deterministic logo scoring for: ${companyName}`);
    console.log(`   Company tokens: ${companyTokens.join(", ")}`);
    console.log(`   Evaluating ${scrapedCandidates.length} candidates...\n`);

    // Deterministic scoring function
    const scoreCandidate = (candidate: {
      url: string;
      source: string;
      priority: number;
    }) => {
      const url = (candidate.url || "").toLowerCase();
      const filename = url.split("/").pop()?.split("?")[0] || "";
      let score = 0;
      const reasons: string[] = [];

      // Base: include some of the DOM priority as signal (header/nav selectors etc.)
      const priorityBoost = Math.round((candidate.priority || 0) / 5);
      if (priorityBoost !== 0) {
        score += priorityBoost;
        reasons.push(`+${priorityBoost} (dom priority)`);
      }

      // Prefer exact slug match (covers logos like "Fri-bevegelse.png" with no "logo" keyword)
      if (companySlug && filename.includes(companySlug)) {
        score += 80;
        reasons.push(`+80 (exact slug: "${companySlug}")`);
      }

      // Token matching in filename/url
      const matchedTokens = companyTokens.filter(
        (token) => filename.includes(token) || url.includes(token)
      );
      if (matchedTokens.length > 0) {
        const allTokensMatched =
          companyTokens.length > 0 &&
          matchedTokens.length === companyTokens.length;
        if (allTokensMatched) {
          score += 80;
          reasons.push(
            `+80 (matches all tokens: "${matchedTokens.join(" ")}")`
          );
        } else {
          score += 25 * matchedTokens.length;
          reasons.push(
            `+${
              25 * matchedTokens.length
            } (partial match: "${matchedTokens.join(" ")}")`
          );
        }
      }

      // Logo-ish filename hints (nice-to-have)
      if (
        filename.includes("custom-logo") ||
        filename.includes("site-logo") ||
        url.includes("custom-logo") ||
        url.includes("site-logo")
      ) {
        score += 30;
        reasons.push("+30 (site-logo/custom-logo)");
      }
      if (filename.includes("logo") || url.includes("/logo")) {
        score += 15;
        reasons.push("+15 (logo keyword)");
      }

      // Format bonuses
      if (url.endsWith(".svg") || url.includes(".svg?")) {
        score += 25;
        reasons.push("+25 (SVG format)");
      } else if (url.endsWith(".png") || url.includes(".png?")) {
        score += 10;
        reasons.push("+10 (PNG format)");
      }

      // Domain match (weak signal; many logos are served via CDN)
      if (domain && url.includes(domain)) {
        score += 5;
        reasons.push("+5 (same domain)");
      }

      // PENALTIES
      if (
        url.includes("favicon") ||
        url.includes("apple-touch-icon") ||
        url.endsWith(".ico")
      ) {
        score -= 200;
        reasons.push("-200 (favicon/icon)");
      }
      if (url.includes("og:image") || url.includes("og-image")) {
        score -= 100;
        reasons.push("-100 (og:image)");
      }

      const thirdPartyMarkers = [
        "teamrobin",
        "rob-logo",
        "rob.no",
        "gulesider",
        "firmalisten",
        "proff",
        "brreg",
        "wix",
        "squarespace",
      ];
      if (thirdPartyMarkers.some((m) => url.includes(m))) {
        score -= 200;
        reasons.push("-200 (third-party/agency marker)");
      }

      if (candidate.source.includes("credits section")) {
        score -= 100;
        reasons.push("-100 (credits section)");
      }

      return { ...candidate, score, reasons };
    };

    // Score all candidates
    const scored = scrapedCandidates
      .map(scoreCandidate)
      .sort((a, b) => b.score - a.score);

    // Log top 3 candidates
    console.log("Top 3 scored candidates:");
    scored.slice(0, 3).forEach((c, i) => {
      console.log(`   ${i + 1}. [score: ${c.score}] ${c.url}`);
      console.log(`      ${c.reasons.join(", ")}`);
    });

    const best = scored[0];

    // Require minimum score to accept
    if (best.score < -50) {
      console.log(
        `\n⚠️ Best candidate score too low (${best.score}), rejecting`
      );
      return null;
    }

    const fileFormat =
      best.url.match(/\.(svg|png|jpg|jpeg|webp)(\?|$)/i)?.[1]?.toUpperCase() ||
      "UNKNOWN";
    const confidence: "high" | "medium" | "low" =
      best.score >= 70 ? "high" : best.score >= 30 ? "medium" : "low";

    console.log(`\n✅ Selected logo (deterministic scoring): ${best.url}`);
    console.log(
      `   Score: ${best.score}, Format: ${fileFormat}, Confidence: ${confidence}\n`
    );

    return {
      logoUrl: best.url,
      fileFormat,
      background: "unknown",
      source: "Deterministic scoring",
      confidence,
    };
  }

  /**
   * Search for company logo using web search when HTML scraping fails
   * Uses Responses API + web_search tool with local ranking for best results
   */
  async findCompanyLogoWithWebSearch(
    companyName: string,
    websiteUrl: string,
    industry?: string
  ): Promise<{
    logoUrl: string;
    fileFormat: string;
    background: string;
    source: string;
    confidence: "high" | "medium" | "low";
  } | null> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    // Extract domain from website URL
    const domain = websiteUrl
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    const companySlug = companyName
      .toLowerCase()
      .replace(/\b(as|asa|ab|ba|sa)\b/gi, " ")
      .replace(/[^a-z0-9æøå\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const companyTokens = companyName
      .toLowerCase()
      .replace(
        /\b(as|asa|ab|ba|sa|holding|group|konsern|stiftelse|forening)\b/gi,
        " "
      )
      .replace(/[^a-zæøå0-9\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    // Build industry-specific queries
    let industryContext = "";
    if (industry) {
      const industryLower = industry.toLowerCase();
      if (
        industryLower.includes("advokat") ||
        industryLower.includes("juridisk") ||
        industryLower.includes("jus")
      ) {
        industryContext = "advokatfirma";
      } else if (
        industryLower.includes("bygg") ||
        industryLower.includes("entreprenør") ||
        industryLower.includes("anlegg")
      ) {
        industryContext = "byggefirma / entreprenør";
      } else if (
        industryLower.includes("helse") ||
        industryLower.includes("trening") ||
        industryLower.includes("fitness")
      ) {
        industryContext = "helse / personlig trening";
      } else {
        industryContext = industry;
      }
    }

    // Super-practical queries for WordPress/CDN assets
    const queries = [
      `site:${domain} (logo OR "custom-logo" OR "site-logo") (png OR svg OR webp OR jpg)`,
      `site:${domain} wp-content logo (png OR svg OR webp OR jpg)`,
      `"${companyName}" site:${domain} logo (png OR svg OR webp OR jpg)`,
      `"${companySlug}" (png OR svg OR webp OR jpg)`,
      `site:${domain} filetype:svg logo`,
      `site:${domain} filetype:png logo`,
    ];

    if (industryContext) {
      queries.push(
        `"${companyName}" ${industryContext} logo (png OR svg OR webp OR jpg)`
      );
    }

    const queryText = queries.join("\n");

    try {
      console.log(`🔍 Searching web for ${companyName} logo...`);

      // Check available models
      const availableModels = await this.listModels();
      console.log(
        `📋 Available models: ${availableModels
          .filter(
            (m) => m.includes("search") || m.includes("4o") || m.includes("4.1")
          )
          .join(", ")}`
      );

      // Use Responses API + web_search tool (most reliable) if available
      const anyClient = this.client as any;
      const canUseResponses =
        typeof anyClient?.responses?.create === "function";
      if (!canUseResponses) {
        console.log(
          "⚠️ Responses API not available in this SDK; cannot run web_search"
        );
        return null;
      }

      const candidateModels = this.getPreferredWebSearchModels(availableModels);
      const isModelNotFound = (err: any): boolean => {
        const msg = (err?.message || "").toLowerCase();
        const status = err?.status || err?.statusCode;
        return (
          status === 404 ||
          msg.includes("model not found") ||
          msg.includes("no such model")
        );
      };

      let text = "";
      let usedModel = "";
      for (const model of candidateModels) {
        try {
          console.log(`🌐 Using Responses API web_search with ${model}`);
          const resp = await anyClient.responses.create({
            model,
            tools: [{ type: "web_search" }],
            tool_choice: "auto",
            input: `Find the PRIMARY brand logo image for the company.

Company: ${companyName}
Company slug (may appear in filenames): ${companySlug}
Official site: ${websiteUrl}
Primary domain: ${domain}

Run these searches and extract DIRECT IMAGE URLs only (must end with .svg .png .webp .jpg or .jpeg):
${queryText}

Rules:
- Return ONLY direct image URLs, one per line, no other text.
- Prefer header/site-logo images (even if the filename does NOT contain the word "logo").
- Prefer images whose filename/path contains the company slug or tokens.
- Accept CDN URLs referenced by the official site.
- Reject favicons, apple-touch-icon, og:image, social-share images, and tiny icons.`,
          });

          text = (resp?.output_text || "").trim();
          usedModel = model;
          break;
        } catch (err: any) {
          if (isModelNotFound(err)) {
            console.log(
              `⚠️ Model not found/available: ${model} (${err.message})`
            );
            continue;
          }
          console.log(`⚠️ web_search failed with ${model}: ${err.message}`);
          continue;
        }
      }

      if (!text) {
        console.log(
          "⚠️ No web_search output (no working model or empty result)"
        );
        return null;
      }

      console.log(`🤖 web_search model used: ${usedModel}`);
      console.log("Web search raw response:", text);

      // 1) Extract direct image URLs from the model output (robust even if it adds noise)
      const urlRegex =
        /https?:\/\/[^\s<>"'()]+?\.(?:svg|png|webp|jpe?g)(?:\?[^\s<>"'()]*)?/gi;
      const rawUrls = (text.match(urlRegex) || []).map((u) =>
        u.replace(/[),.;!?\]]+$/, "")
      );
      const urls = Array.from(new Set(rawUrls));

      console.log(`Found ${urls.length} candidate logo URLs`);

      if (!urls.length) {
        console.log("⚠️ No logo URLs found in search results");
        return null;
      }

      // 2) Filter out obvious non-logos
      const blocked = [
        "favicon",
        "apple-touch-icon",
        "mask-icon",
        "manifest",
        "og:image",
        "og-image",
        "social",
        "share",
        "icon-",
      ];
      const filtered = urls.filter((u) => {
        const lower = u.toLowerCase();
        const isBlocked = blocked.some((b) => lower.includes(b));
        if (isBlocked) {
          console.log(`   ❌ Filtered: ${u} (blocked term)`);
        }
        return !isBlocked;
      });

      console.log(`${filtered.length} candidates after filtering`);

      if (!filtered.length) {
        console.log("⚠️ No valid logo candidates after filtering");
        return null;
      }

      // 3) Rank: company-name match first (slug/tokens), then logo-ish hints, then format
      const score = (u: string) => {
        const l = u.toLowerCase();
        let s = 0;
        const filename = (u.split("/").pop() || "").toLowerCase();

        // Strong signal: filename contains company slug or all tokens
        if (companySlug && filename.includes(companySlug)) s += 80;
        const matched = companyTokens.filter(
          (t) => filename.includes(t) || l.includes(t)
        );
        if (companyTokens.length > 0 && matched.length === companyTokens.length)
          s += 80;
        if (matched.length > 0) s += 25 * matched.length;

        if (l.includes("custom-logo") || l.includes("site-logo")) s += 30;
        if (l.includes("logo")) s += 15;

        if (l.endsWith(".svg") || l.includes(".svg?")) s += 25;
        if (l.endsWith(".png") || l.includes(".png?")) s += 10;
        if (l.includes("wp-content/uploads")) s += 10;
        if (l.includes(domain)) s += 5;

        const thirdPartyMarkers = [
          "teamrobin",
          "rob-logo",
          "rob.no",
          "gulesider",
          "firmalisten",
          "proff",
          "brreg",
          "wix",
          "squarespace",
        ];
        if (thirdPartyMarkers.some((m) => l.includes(m))) s -= 200;

        // Penalize very long filenames (often generated thumbnails)
        if (filename.length > 80) s -= 10;
        return s;
      };

      const ranked = filtered
        .map((u) => ({ url: u, score: score(u) }))
        .sort((a, b) => b.score - a.score);

      console.log("Top 3 ranked candidates:");
      ranked.slice(0, 3).forEach((r, i) => {
        console.log(`   ${i + 1}. [score: ${r.score}] ${r.url}`);
      });

      const best = ranked[0];
      const format =
        best.url.match(/\.(svg|png|webp|jpe?g)(\?|$)/i)?.[1]?.toUpperCase() ||
        "UNKNOWN";
      const confidence: "high" | "medium" | "low" =
        best.score >= 70 ? "high" : best.score >= 40 ? "medium" : "low";

      console.log(`✅ Selected logo: ${best.url}`);
      console.log(
        `   Format: ${format}, Score: ${best.score}, Confidence: ${confidence}`
      );

      return {
        logoUrl: best.url,
        fileFormat: format,
        background: "unknown",
        source: "OpenAI web_search + local ranking",
        confidence,
      };
    } catch (error: any) {
      console.error("Web search logo finding failed:", error.message);
      return null;
    }
  }
}
