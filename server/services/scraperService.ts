import axios from "axios";
import * as cheerio from "cheerio";

export interface CompanyInfo {
  companyName: string;
  styretsleder: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  observations: string[];
}

export class ScraperService {
  private static readonly blockedWebsiteSubstrings = [
    "proff.no",
    "forvalt.no",
    "enento",
    "brreg.no",
    "kredittsjekk",
    "analyser",
    "verdivurdering",
    "facebook.com",
    "linkedin.com",
    "instagram.com",
    "twitter.com",
    "youtube.com",
    "google.",
    "mailto:",
  ];

  private static normalizeCompanyName(companyName: string): string {
    return companyName
      .toLowerCase()
      .replace(/\b(as|asa|sa|ans|enk|en|ab|oy|ltd|limited)\b/g, " ")
      .replace(/[^a-z0-9æøå\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static urlLooksBlocked(url: string): boolean {
    const lower = url.toLowerCase();
    return ScraperService.blockedWebsiteSubstrings.some((s) => lower.includes(s));
  }

  private static urlLooksLikeWebsite(url: string): boolean {
    if (!url) return false;
    if (ScraperService.urlLooksBlocked(url)) return false;

    // Only accept normal http(s) URLs.
    if (!/^https?:\/\//i.test(url)) return false;

    // Avoid obviously bogus URLs.
    if (url.length > 200) return false;
    if (/\s/.test(url)) return false;
    if (
      url.includes("<") ||
      url.includes(">") ||
      url.includes('"') ||
      url.includes("{") ||
      url.includes("}") ||
      url.includes("|") ||
      url.includes("\\") ||
      url.includes("^") ||
      url.includes("`") ||
      url.includes("[") ||
      url.includes("]")
    ) {
      return false;
    }

    return true;
  }

  /**
   * Fetches the URL and checks that the page plausibly belongs to the company.
   * Returns the final (possibly redirected) URL if valid, otherwise empty string.
   */
  async validateCompanyWebsite(url: string, companyName: string): Promise<string> {
    if (!ScraperService.urlLooksLikeWebsite(url)) return "";
    if (!companyName) return "";

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl: string =
        (response.request as any)?.res?.responseUrl || response.config.url || url;

      if (!ScraperService.urlLooksLikeWebsite(finalUrl)) return "";

      const $ = cheerio.load(response.data);
      const title = ($("title").text() || "").toLowerCase();
      const h1 = ($("h1").first().text() || "").toLowerCase();
      const bodyText = ($("body").text() || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 12000);

      const normalizedCompany = ScraperService.normalizeCompanyName(companyName);
      if (!normalizedCompany) return "";

      const companyTokens = normalizedCompany
        .split(" ")
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .slice(0, 6);

      const haystack = `${title} ${h1} ${bodyText}`;

      // Strong match if full normalized name appears.
      if (haystack.includes(normalizedCompany)) {
        return finalUrl;
      }

      // Otherwise require at least 2 meaningful tokens to appear.
      let matched = 0;
      for (const token of companyTokens) {
        if (haystack.includes(token)) matched += 1;
      }

      const requiredMatches = companyTokens.length >= 2 ? 2 : 1;
      return matched >= requiredMatches ? finalUrl : "";
    } catch {
      return "";
    }
  }

  private static normalizeHost(host: string): string {
    const lower = (host || "").toLowerCase();
    return lower.startsWith("www.") ? lower.slice(4) : lower;
  }

  isUrlOnCompanyDomain(candidateUrl: string, companyWebsite: string): boolean {
    try {
      const candidateHost = ScraperService.normalizeHost(new URL(candidateUrl).host);
      const baseHost = ScraperService.normalizeHost(new URL(companyWebsite).host);

      if (!candidateHost || !baseHost) return false;
      if (candidateHost === baseHost) return true;
      if (candidateHost.endsWith(`.${baseHost}`)) return true;
      if (baseHost.endsWith(`.${candidateHost}`)) return true;

      return false;
    } catch {
      return false;
    }
  }

  async fetchPageBodyText(url: string): Promise<{ finalUrl: string; text: string }> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl: string =
        (response.request as any)?.res?.responseUrl || response.config.url || url;

      const $ = cheerio.load(response.data);
      const text = $("body").text().replace(/\s+/g, " ").trim();
      return { finalUrl, text };
    } catch {
      return { finalUrl: url, text: "" };
    }
  }

  async scrapeProffPage(proffUrl: string): Promise<Partial<CompanyInfo>> {
    try {
      const response = await axios.get(proffUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "no,nb;q=0.9,nn;q=0.8,en;q=0.7",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Extract company name - try multiple selectors
      let companyName = "";
      companyName =
        $("h1").first().text().trim() ||
        $('[class*="company"]').first().text().trim() ||
        $('[class*="name"]').first().text().trim() ||
        $("title").text().split("-")[0].trim();

      console.log("Found company name:", companyName);

      // Try to find Daglig leder (Managing Director/CEO) - this is the primary contact person
      let styretsleder = "";

      // Method 1: Look specifically in "Offisiell foretaksinformasjon" section for "Daglig leder" field
      $('dt, th, .label, [class*="label"]').each((i, elem) => {
        const labelText = $(elem).text().trim();
        if (labelText === "Daglig leder" || labelText.includes("Daglig leder")) {
          // Find the corresponding value (next sibling or parent's next sibling)
          let valueElem = $(elem).next();
          if (!valueElem.length) {
            valueElem = $(elem).parent().next();
          }
          
          const cellText = valueElem.text().trim();
          console.log("Found 'Daglig leder' field with value:", cellText);
          
          // Validate it's a person's name
          if (
            cellText &&
            cellText.length < 50 &&
            !cellText.match(/\d{3,}/) && // No numbers with 3+ digits
            !cellText.toLowerCase().includes("org") &&
            !cellText.toLowerCase().includes("telefon") &&
            !cellText.toLowerCase().includes("adresse") &&
            cellText.match(/^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/) // 2-3 capitalized words
          ) {
            styretsleder = cellText;
            return false; // Stop searching
          }
        }
      });

      // Method 2: Look for Daglig leder in table rows (PRIORITY)
      if (!styretsleder) {
        $("tr, .row, [class*='row']").each((i, elem) => {
          const rowText = $(elem).text().toLowerCase();
          if (
            rowText.includes("daglig leder") ||
            rowText.includes("adm. direktør") ||
            rowText.includes("administrerende direktør")
          ) {
            const cells = $(elem).find("td, div, span");
            cells.each((j, cell) => {
              const cellText = $(cell).text().trim();
              // Check if this looks like a person's name (has at least 2 words with capitals)
              // Must be short (max 50 chars), no numbers, no "org nr", no phone patterns
              if (
                cellText &&
                cellText.length < 50 &&
                !cellText.match(/\d{3,}/) && // No numbers with 3+ digits (phone, org nr)
                !cellText.toLowerCase().includes("org") &&
                !cellText.toLowerCase().includes("telefon") &&
                !cellText.toLowerCase().includes("adresse") &&
                !cellText.toLowerCase().includes("daglig") &&
                !cellText.toLowerCase().includes("direktør") &&
                cellText.match(/^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/) // 2-3 capitalized words only
              ) {
                styretsleder = cellText;
                return false;
              }
            });
            if (styretsleder) return false;
          }
        });
      }

      // Method 3: Look for Styrets leder only if Daglig leder not found
      if (!styretsleder) {
        $('dt, th, .label, [class*="label"]').each((i, elem) => {
          const labelText = $(elem).text().trim();
          if (labelText === "Styrets leder" || labelText.includes("Styrets leder")) {
            let valueElem = $(elem).next();
            if (!valueElem.length) {
              valueElem = $(elem).parent().next();
            }
            
            const cellText = valueElem.text().trim();
            console.log("Found 'Styrets leder' field with value:", cellText);
            
            if (
              cellText &&
              cellText.length < 50 &&
              !cellText.match(/\d{3,}/) &&
              !cellText.toLowerCase().includes("org") &&
              !cellText.toLowerCase().includes("telefon") &&
              !cellText.toLowerCase().includes("adresse") &&
              cellText.match(/^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/)
            ) {
              styretsleder = cellText;
              return false;
            }
          }
        });
      }

      // Method 4: Look in table rows for Styrets leder
      if (!styretsleder) {
        $("tr, .row, [class*='row']").each((i, elem) => {
          const rowText = $(elem).text().toLowerCase();
          if (
            rowText.includes("styrets leder") ||
            rowText.includes("styreleder")
          ) {
            const cells = $(elem).find("td, div, span");
            cells.each((j, cell) => {
              const cellText = $(cell).text().trim();
              if (
                cellText &&
                cellText.length < 50 &&
                !cellText.match(/\d{3,}/) &&
                !cellText.toLowerCase().includes("org") &&
                !cellText.toLowerCase().includes("telefon") &&
                !cellText.toLowerCase().includes("adresse") &&
                !cellText.toLowerCase().includes("styret") &&
                cellText.match(/^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/)
              ) {
                styretsleder = cellText;
                return false;
              }
            });
            if (styretsleder) return false;
          }
        });
      }

      // Method 5: Look through all text more broadly for Daglig leder
      if (!styretsleder) {
        const pageText = $("body").text();
        const dagligLederMatch = pageText.match(
          /Daglig leder[:\s]+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)+)/
        );
        if (dagligLederMatch) {
          styretsleder = dagligLederMatch[1].trim();
        } else {
          const styretslederMatch = pageText.match(
            /Styrets leder[:\s]+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)+)/
          );
          if (styretslederMatch) {
            styretsleder = styretslederMatch[1].trim();
          }
        }
      }

      console.log("Found contact person (Daglig leder/Styrets leder):", styretsleder || "Not found");

      // Try to find website - look for actual company website links
      let website = "";
      const foundLinks: string[] = [];

      console.log("\n=== SEARCHING FOR WEBSITE IN PROFF.NO HTML ===");

      // Collect all external links from Proff.no page
      $('a[href^="http"]').each((i, elem) => {
        const href = $(elem).attr("href") || "";
        // const text = $(elem).text().trim();
        
        // Filter out bad domains
        if (
          href.includes("proff.no") ||
          href.includes("forvalt.no") ||
          href.includes("enento") ||
          href.includes("brreg.no") ||
          href.includes("kredittsjekk") ||
          href.includes("analyser") ||
          href.includes("verdivurdering") ||
          href.includes("facebook") ||
          href.includes("linkedin") ||
          href.includes("instagram") ||
          href.includes("twitter") ||
          href.includes("youtube") ||
          href.includes("google") ||
          href.includes("mailto:")
        ) {
          return true; // Skip this link
        }
        
        // Look for actual company domains (.no, .com, .org, .net)
        // NOTE: Use RegExp constructor to avoid no-useless-escape warnings in regex literals.
        if (
          new RegExp(
            "^https?:\\/\\/[^/]+\\.(no|com|org|net)(\\/|$)",
            "i"
          ).test(href)
        ) {
          foundLinks.push(href);
          console.log(`✅ Found valid link: ${href}`);
          
          if (!website) {
            website = href;
            console.log(`🎯 Selected as company website`);
          }
        }
      });

      console.log(`\n=== WEBSITE SEARCH SUMMARY ===`);
      console.log(`Total valid company links: ${foundLinks.length}`);
      console.log("Selected website:", website || "❌ NOT FOUND");
      console.log("===========================\n");

      if (!website) {
        console.warn("⚠️ NO WEBSITE FOUND IN PROFF.NO HTML");
        console.warn("⚠️ The company may not have their website listed on Proff.no");
        console.warn("⚠️ You may need to manually find and add the website");
      }

      return {
        companyName,
        styretsleder: styretsleder || "",
        website: website || "",
      };
    } catch (error: any) {
      console.error("Proff scraping failed:", error.message);
      throw new Error("Failed to scrape Proff.no page");
    }
  }

  async scrapeWebsiteForContact(
    websiteUrl: string
  ): Promise<{
    email: string;
    phone: string;
    websiteContent: string;
    observations: string[];
  }> {
    try {
      console.log("Scraping website:", websiteUrl);
      const response = await axios.get(websiteUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const observations: string[] = [];

      // Extract full text content for OpenAI analysis
      let websiteContent = $("body").text().replace(/\s+/g, " ").trim();

      // Look for contact, about, and team pages and scrape them too
      const contactLinks = $(
        'a[href*="kontakt"], a[href*="contact"], a[href*="om-oss"], a[href*="about"], a[href*="team"], a[href*="ansatte"], a[href*="people"]'
      );
      
      console.log(`Found ${contactLinks.length} potential contact/about pages`);
      
      // Scrape up to 3 relevant pages
      const pagesToScrape: string[] = [];
      contactLinks.slice(0, 3).each((i, elem) => {
        const href = $(elem).attr("href");
        if (href) {
          pagesToScrape.push(href);
        }
      });

      for (const href of pagesToScrape) {
        try {
          const pageUrl = new URL(href, websiteUrl).href;
          console.log("Scraping additional page:", pageUrl);
          
          const pageResponse = await axios.get(pageUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            timeout: 10000,
          });
          const $page = cheerio.load(pageResponse.data);
          const pageText = $page("body").text().replace(/\s+/g, " ").trim();
          
          // Append this page's content
          websiteContent += " " + pageText;
        } catch (e) {
          console.error(`Failed to scrape ${href}:`, e);
        }
      }

      // Extract email addresses
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = websiteContent.match(emailRegex) || [];

      // Extract phone numbers (Norwegian format)
      const phoneRegex = /(?:\+47|0047)?\s*[2-9]\d{7}|\d{3}\s?\d{2}\s?\d{3}/g;
      const phones = websiteContent.match(phoneRegex) || [];

      // Filter out common non-contact emails
      let contactEmail =
        emails.find(
          (email) =>
            !email.includes("example") &&
            !email.includes("noreply") &&
            !email.includes("no-reply") &&
            !email.includes("support") &&
            !email.includes("help")
        ) || "";

      const digitsOnly = (s: string) => s.replace(/\D/g, "");
      const isNorwegianMobile = (p: string) => {
        const digits = digitsOnly(p);
        const last8 = digits.length >= 8 ? digits.slice(-8) : digits;
        return last8.length === 8 && (last8.startsWith("4") || last8.startsWith("9"));
      };

      // Prefer mobile numbers first (often the most direct/personal).
      let contactPhone = phones.find(isNorwegianMobile) || phones[0] || "";

      console.log(`Found ${emails.length} emails and ${phones.length} phones on website`);

      // Generate observations about the website
      const hasVideo =
        $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;
      const hasImages = $("img").length;
      const hasModernDesign = $("nav, header, footer").length > 2;
      const hasCTA = $("button, a.cta, a.btn").length;

      if (!hasVideo) {
        observations.push(
          "Nettstedet mangler videoinnhold som kunne engasjert besøkende bedre"
        );
      }
      if (hasImages < 5) {
        observations.push(
          "Begrenset med profesjonelt visuelt innhold og bilder"
        );
      }
      if (!hasModernDesign) {
        observations.push(
          "Designet virker noe utdatert og kunne trengt modernisering"
        );
      }
      if (hasCTA < 2) {
        observations.push(
          "Manglende tydelige call-to-action knapper for konvertering"
        );
      }

      return {
        email: contactEmail,
        phone: contactPhone,
        websiteContent,
        observations: observations.slice(0, 2), // Max 2 observations
      };
    } catch (error: any) {
      console.error("Website scraping failed:", error.message);
      return {
        email: "",
        phone: "",
        websiteContent: "",
        observations: [
          "Nettstedet kunne dra nytte av forbedret synlighet og struktur",
        ],
      };
    }
  }

  async getCompanyInfo(proffUrl: string): Promise<CompanyInfo> {
    // First scrape Proff.no
    const proffInfo = await this.scrapeProffPage(proffUrl);

    if (!proffInfo.companyName) {
      throw new Error("Could not extract company information from Proff.no");
    }

    let website = proffInfo.website || "";
    let contactEmail = "";
    let contactPhone = "";
    let observations: string[] = [];

    // If we found a website, scrape it for contact info
    if (website) {
      try {
        const websiteInfo = await this.scrapeWebsiteForContact(website);
        contactEmail = websiteInfo.email;
        contactPhone = websiteInfo.phone;
        observations = websiteInfo.observations;

        // Store website content for potential OpenAI analysis
        (this as any).lastWebsiteContent = websiteInfo.websiteContent;
      } catch (error) {
        console.error("Failed to scrape website:", error);
      }
    }

    // IMPORTANT: Never guess a website URL. If Proff doesn't list it, we leave it empty
    // and let the controller perform a verified web-search lookup.

    return {
      companyName: proffInfo.companyName,
      styretsleder: proffInfo.styretsleder || "",
      website,
      contactEmail,
      contactPhone,
      observations,
    };
  }

  getLastWebsiteContent(): string {
    return (this as any).lastWebsiteContent || "";
  }
}
