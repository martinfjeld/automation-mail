import OpenAI from "openai";

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      // Make a minimal test request
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
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

Hilsen: "${
      contactPerson ? `Hei ${contactPerson.split(" ")[0]},` : "Hei,"
    }"

Maks 150 ord. Start med en setning om hvorfor jeg tar kontakt. Inkluder call-to-action for et kort møte.

Nettside: ${websiteUrl}

AVSLUTNING (OBLIGATORISK):
- E-posten skal ende med nøyaktig denne linjen og INGENTING etterpå:
Med vennlig hilsen,
- IKKE legg til navn, firma, signatur, telefon, tittel eller annen tekst etter dette.
- IKKE skriv "Martin Fjeld" eller "No Offence" i bunn eller som signatur.

SPRÅKREGEL (VIKTIG):
- Hvis du nevner avsender + selskap i brødteksten, bruk riktig formulering:
  "Jeg heter Martin Fjeld og jobber i No Offence."
- IKKE skriv "jobber med No Offence".

KRITISKE SKRIVEREGLER:
→ Bruk enkelt språk - korte, klare setninger
→ UNNGÅ AI-klisjéer som "dykke ned i," "låse opp," "game-changing," "banebrytende"
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
      console.log(`Sending ${websiteContent.substring(0, 12000).length} chars to OpenAI for ${contactPersonName}...`);
      
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

        const last8 = phoneDigits.length >= 8 ? phoneDigits.slice(-8) : phoneDigits;
        const isNorwegianMobile =
          last8.length === 8 && (last8.startsWith("4") || last8.startsWith("9"));

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

      return urls.slice(0, 5).map((url) => ({ url, reason: "", sourceUrls: [] }));
    } catch (error: any) {
      console.error("AI person contact page candidate search failed:", error.message);
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
  ): Promise<
    Array<{ url: string; reason: string; sourceUrls: string[] }>
  > {
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

KRITISK:
- Ikke finn på URLer. Du må bare returnere URLer du faktisk finner i søkeresultater.
- Ikke returner katalog/registre (proff.no, brreg.no, forvalt.no, enento osv).
- Ikke returner sosiale medier.
- Returner opptil 5 kandidater.

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

      // Preferred: parse JSON response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

          const fromJson = candidates
            .map((c: any) => ({
              url: typeof c.url === "string" ? c.url : "",
              reason: typeof c.reason === "string" ? c.reason : "",
              sourceUrls: Array.isArray(c.sourceUrls)
                ? c.sourceUrls.filter((u: any) => typeof u === "string")
                : [],
            }))
            .filter((c: any) => c.url);

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
      );

      return urls.slice(0, 5).map((url) => ({ url, reason: "", sourceUrls: [] }));
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

    const prompt = `Finn følgende informasjon fra Proff.no-siden (${proffUrl}):
            
- Daglig leder (hent kun fra 'Offisiell foretaksinformasjon')
- Generell e-post og telefon (besøk ${website || 'bedriftens nettside'} hvis tilgjengelig)
- Gjør et nytt søk på: "${contactPerson || 'daglig leder'} ${website || companyName}" og finn eventuelt e-post eller nummer direkte til personen.

KRITISK: IKKE finn eller generer nettside-URL. Det håndteres eksternt.

Svar kun i JSON:
{
  "selskap": "",
  "navn": "",
  "kundeEpost": "",
  "telefon": "",
  "bransje": ""
}}`;

    try {
      console.log("Starting AI web search enrichment with gpt-4o-search-preview...");
      
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
        return {
          selskap: json.selskap || "",
          navn: json.navn || "",
          kundeEpost: json.kundeEpost || "",
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
}
