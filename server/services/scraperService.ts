import axios from "axios";
import * as cheerio from "cheerio";
import { OpenAIService } from "./openaiService";

export interface CompanyInfo {
  companyName: string;
  styretsleder: string;
  address: string;
  city: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  observations: string[];
  logoUrl?: string;
}

export class ScraperService {
  private openaiService?: OpenAIService;

  constructor(openaiService?: OpenAIService) {
    this.openaiService = openaiService;
  }

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
    return ScraperService.blockedWebsiteSubstrings.some((s) =>
      lower.includes(s)
    );
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
  async validateCompanyWebsite(
    url: string,
    companyName: string
  ): Promise<string> {
    if (!ScraperService.urlLooksLikeWebsite(url)) return "";
    if (!companyName) return "";

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl: string =
        (response.request as any)?.res?.responseUrl ||
        response.config.url ||
        url;

      if (!ScraperService.urlLooksLikeWebsite(finalUrl)) return "";

      const $ = cheerio.load(response.data);
      const title = ($("title").text() || "").toLowerCase();
      const h1 = ($("h1").first().text() || "").toLowerCase();
      const bodyText = ($("body").text() || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 12000);

      const normalizedCompany =
        ScraperService.normalizeCompanyName(companyName);
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
      const candidateHost = ScraperService.normalizeHost(
        new URL(candidateUrl).host
      );
      const baseHost = ScraperService.normalizeHost(
        new URL(companyWebsite).host
      );

      if (!candidateHost || !baseHost) return false;
      if (candidateHost === baseHost) return true;
      if (candidateHost.endsWith(`.${baseHost}`)) return true;
      if (baseHost.endsWith(`.${candidateHost}`)) return true;

      return false;
    } catch {
      return false;
    }
  }

  async fetchPageBodyText(
    url: string
  ): Promise<{ finalUrl: string; text: string }> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const finalUrl: string =
        (response.request as any)?.res?.responseUrl ||
        response.config.url ||
        url;

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
        if (
          labelText === "Daglig leder" ||
          labelText.includes("Daglig leder")
        ) {
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
            cellText.match(
              /^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/
            ) // 2-3 capitalized words
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
                cellText.match(
                  /^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/
                ) // 2-3 capitalized words only
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
          if (
            labelText === "Styrets leder" ||
            labelText.includes("Styrets leder")
          ) {
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
              cellText.match(
                /^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/
              )
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
                cellText.match(
                  /^[A-ZÆØÅ][a-zæøå]+\s+[A-ZÆØÅ][a-zæøå]+(\s+[A-ZÆØÅ][a-zæøå]+)?$/
                )
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

      console.log(
        "Found contact person (Daglig leder/Styrets leder):",
        styretsleder || "Not found"
      );

      // Try to find company address from official info section
      let address = "";
      let city = "";
      const cleanAddress = (value: string): string => {
        return (value || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .replace(/\b(Vis kart|Se kart|Kart|Google Maps)\b/gi, "")
          .replace(/\s+,/g, ",")
          .replace(/,\s+/g, ", ")
          .trim();
      };

      const looksLikeAddress = (value: string): boolean => {
        const v = cleanAddress(value);
        if (!v) return false;
        if (v.length < 6 || v.length > 160) return false;
        const lower = v.toLowerCase();
        if (lower.includes("org nr") || lower.includes("organisasjonsnummer"))
          return false;
        if (
          lower.includes("telefon") ||
          lower.includes("nettside") ||
          lower.includes("hjemmeside")
        )
          return false;
        if (lower.includes("daglig leder") || lower.includes("styrets leder"))
          return false;
        if (v.includes("@")) return false;
        // Basic: must contain both letters and numbers
        if (!/[A-Za-zÆØÅæøå]/.test(v)) return false;
        if (!/\d/.test(v)) return false;
        return true;
      };

      const parseNoAddressParts = (
        fullAddress: string
      ): { addressLine: string; city: string } => {
        const cleaned = cleanAddress(fullAddress);
        if (!cleaned) return { addressLine: "", city: "" };

        // Common Norwegian format: "Street 1, 1234 OSLO" (comma optional)
        const m = cleaned.match(
          /^(.*?)(?:,)?\s*(\d{4})\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\-\s\.]+)$/
        );
        if (m) {
          const addressLine = (m[1] || "").trim().replace(/,$/, "");
          const parsedCity = (m[3] || "").trim();
          return {
            addressLine: addressLine || cleaned,
            city: parsedCity,
          };
        }

        // If we cannot safely split, return the whole string as address.
        return { addressLine: cleaned, city: "" };
      };

      const addressLabelPriority: Array<{ match: RegExp; base: number }> = [
        { match: /forretningsadresse/i, base: 100 },
        { match: /besøksadresse|besoksadresse/i, base: 90 },
        { match: /postadresse/i, base: 80 },
        { match: /^adresse$/i, base: 70 },
      ];

      const scoreAddressCandidate = (
        labelText: string,
        valueText: string
      ): number => {
        const cleaned = cleanAddress(valueText);
        let score = 0;
        for (const p of addressLabelPriority) {
          if (p.match.test(labelText)) {
            score += p.base;
            break;
          }
        }
        if (/\b\d{4}\b/.test(cleaned)) score += 20; // Norwegian postal code
        if (/\b\d+[A-Za-zÆØÅæøå]?\b/.test(cleaned)) score += 10; // street number
        if (
          /\b(oslo|bergen|trondheim|stavanger|tromsø|tromso)\b/i.test(cleaned)
        )
          score += 2;
        // Penalize extremely long strings (often includes extra labels)
        if (cleaned.length > 110) score -= 10;
        return score;
      };

      type AddressCandidate = { label: string; value: string; score: number };
      const addressCandidates: AddressCandidate[] = [];

      // Method 1: dt/dd or th/td label-value layout
      $('dt, th, .label, [class*="label"]').each((_, elem) => {
        const labelText = ($(elem).text() || "").replace(/\s+/g, " ").trim();
        if (!labelText) return;

        const isAddressLabel = addressLabelPriority.some((p) =>
          p.match.test(labelText)
        );
        if (!isAddressLabel) return;

        let valueElem = $(elem).next();
        if (!valueElem.length) {
          valueElem = $(elem).parent().next();
        }

        const valueText = cleanAddress(valueElem.text() || "");
        if (!looksLikeAddress(valueText)) return;

        addressCandidates.push({
          label: labelText,
          value: valueText,
          score: scoreAddressCandidate(labelText, valueText),
        });
      });

      // Method 2: table/row layout where address label and value appear in same row
      if (addressCandidates.length === 0) {
        $("tr, .row, [class*='row']").each((_, elem) => {
          const rowText = ($(elem).text() || "").replace(/\s+/g, " ").trim();
          if (!rowText) return;

          const labelHit = addressLabelPriority.find((p) =>
            p.match.test(rowText)
          );
          if (!labelHit) return;

          // Heuristic: try last cell/span text as value
          const cells = $(elem).find("td, dd, div, span");
          const valueText = cleanAddress(cells.last().text() || "");
          if (!looksLikeAddress(valueText)) return;

          addressCandidates.push({
            label: rowText,
            value: valueText,
            score: labelHit.base + scoreAddressCandidate(rowText, valueText),
          });
        });
      }

      // Method 3: fallback regex on full page text
      if (addressCandidates.length === 0) {
        const pageText = ($("body").text() || "").replace(/\s+/g, " ");
        const labelRegexes: Array<{ label: string; re: RegExp }> = [
          {
            label: "Forretningsadresse",
            re: /Forretningsadresse\s*[:\-]?\s*([^]+?)(?=\b(Postadresse|Besøksadresse|Org\s*nr|Organisasjonsnummer|Telefon|Nettsted|Hjemmeside|Daglig leder|Styrets leder)\b)/i,
          },
          {
            label: "Besøksadresse",
            re: /Besøksadresse\s*[:\-]?\s*([^]+?)(?=\b(Forretningsadresse|Postadresse|Org\s*nr|Organisasjonsnummer|Telefon|Nettsted|Hjemmeside|Daglig leder|Styrets leder)\b)/i,
          },
          {
            label: "Postadresse",
            re: /Postadresse\s*[:\-]?\s*([^]+?)(?=\b(Forretningsadresse|Besøksadresse|Org\s*nr|Organisasjonsnummer|Telefon|Nettsted|Hjemmeside|Daglig leder|Styrets leder)\b)/i,
          },
        ];

        for (const lr of labelRegexes) {
          const m = pageText.match(lr.re);
          if (!m) continue;
          const valueText = cleanAddress(m[1]);
          if (!looksLikeAddress(valueText)) continue;
          addressCandidates.push({
            label: lr.label,
            value: valueText,
            score: scoreAddressCandidate(lr.label, valueText),
          });
          break;
        }
      }

      if (addressCandidates.length > 0) {
        addressCandidates.sort((a, b) => b.score - a.score);
        const parts = parseNoAddressParts(addressCandidates[0].value);
        address = parts.addressLine;
        city = parts.city;
      }

      console.log("Found address:", address || "Not found");
      console.log("Found city:", city || "Not found");

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
          new RegExp("^https?:\\/\\/[^/]+\\.(no|com|org|net)(\\/|$)", "i").test(
            href
          )
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
        console.warn(
          "⚠️ The company may not have their website listed on Proff.no"
        );
        console.warn("⚠️ You may need to manually find and add the website");
      }

      return {
        companyName,
        styretsleder: styretsleder || "",
        address: address || "",
        city: city || "",
        website: website || "",
      };
    } catch (error: any) {
      console.error("Proff scraping failed:", error.message);
      throw new Error("Failed to scrape Proff.no page");
    }
  }

  /**
   * Finds company logo by directly inspecting the website's DOM.
   * This is more reliable than AI search since it examines the actual live website.
   */
  async findCompanyLogo(
    companyName: string,
    websiteUrl: string,
    industry?: string
  ): Promise<string> {
    // Use direct DOM inspection (web scraping) as primary method
    console.log("🔍 Inspecting website DOM for logo...");
    const scrapedResult = await this.scrapeLogoFromWebsiteWithCandidates(
      websiteUrl,
      companyName
    );

    // If we have candidates, always let the deterministic scorer choose.
    // The DOM heuristic winner can still be wrong (e.g., real logos without "logo" in filename).
    if (scrapedResult.candidates.length > 0 && this.openaiService) {
      try {
        console.log(
          `🤖 Found ${scrapedResult.candidates.length} candidates, asking AI to choose the best one...`
        );
        const aiResult = await this.openaiService.findCompanyLogo(
          companyName,
          websiteUrl,
          scrapedResult.candidates
        );

        if (aiResult && aiResult.logoUrl) {
          console.log(`✅ AI selected: ${aiResult.logoUrl}`);
          return aiResult.logoUrl;
        }
      } catch (error: any) {
        console.error("AI selection failed:", error.message);
      }
    }

    // Fallback: use DOM heuristic winner if present
    if (scrapedResult.logoUrl) {
      console.log("✅ Logo found via DOM inspection:", scrapedResult.logoUrl);
      return scrapedResult.logoUrl;
    }

    // Fallback: Use web search to find logo when DOM scraping fails
    if (this.openaiService) {
      try {
        console.log("🌐 No logo in HTML, searching web for logo images...");
        const webSearchResult =
          await this.openaiService.findCompanyLogoWithWebSearch(
            companyName,
            websiteUrl,
            industry
          );

        if (webSearchResult && webSearchResult.logoUrl) {
          console.log(
            `✅ Logo found via web search: ${webSearchResult.logoUrl} (${webSearchResult.confidence} confidence)`
          );
          return webSearchResult.logoUrl;
        }
      } catch (error: any) {
        console.error("Web search logo finding failed:", error.message);
      }
    }

    console.log("⚠️ No logo could be found");
    return "";
  }

  async scrapeLogoFromWebsiteWithCandidates(
    websiteUrl: string,
    companyName: string
  ): Promise<{
    logoUrl: string;
    candidates: Array<{ url: string; source: string; priority: number }>;
  }> {
    try {
      console.log("Scraping logo from:", websiteUrl);
      const response = await axios.get(websiteUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const baseUrl = new URL(websiteUrl);
      const candidates: Array<{
        url: string;
        priority: number;
        source: string;
        width?: number;
        height?: number;
      }> = [];

      // Helper to extract dimensions from URL (e.g., w_180, 180x180, etc.)
      const extractDimensionsFromUrl = (
        url: string
      ): { width?: number; height?: number } => {
        const widthMatch =
          url.match(/[w_](\d{2,4})[,_\s]/i) || url.match(/\/(\d{2,4})x\d{2,4}/);
        const heightMatch =
          url.match(/[h_](\d{2,4})[,_\s]/i) || url.match(/\/\d{2,4}x(\d{2,4})/);
        return {
          width: widthMatch ? parseInt(widthMatch[1]) : undefined,
          height: heightMatch ? parseInt(heightMatch[1]) : undefined,
        };
      };

      // Helper to validate and score logo candidates
      const addCandidate = (elem: any, priority: number, source: string) => {
        const $elem = $(elem);
        const src =
          $elem.attr("src") ||
          $elem.attr("data-src") ||
          $elem.attr("data-lazy-src");
        if (!src) return;

        try {
          const url = new URL(src, baseUrl.origin).href;

          // Check if image is in a "made by" / "created by" section
          // Instead of hard-rejecting, we'll apply a heavy penalty
          const parents = $elem.parents().addBack();
          let creditsScore = 0;

          parents.each((i, parent) => {
            const $parent = $(parent);
            const parentText = ($parent.text() || "").toLowerCase();
            const parentClass = ($parent.attr("class") || "").toLowerCase();
            const parentId = ($parent.attr("id") || "").toLowerCase();

            // Check for "made by" / "created by" / "designed by" patterns
            if (
              parentText.includes("laget av") ||
              parentText.includes("made by") ||
              parentText.includes("created by") ||
              parentText.includes("designed by") ||
              parentText.includes("utviklet av") ||
              parentText.includes("developed by") ||
              parentText.includes("bygget av") ||
              parentText.includes("built by") ||
              parentClass.includes("credit") ||
              parentClass.includes("byline") ||
              parentId.includes("credit") ||
              parentId.includes("byline")
            ) {
              creditsScore = -100; // Heavy penalty instead of hard rejection
              return false; // break out of each loop
            }
          });

          // Apply credits penalty to priority
          if (creditsScore < 0) {
            priority += creditsScore;
            source += " (in credits section)";
            console.log(`⚠️ Logo in credits section (penalized): ${url}`);
          }

          // Skip data URIs and obvious non-logos
          if (url.includes("data:")) return;
          const urlLower = url.toLowerCase();
          if (urlLower.includes("banner")) return;
          if (urlLower.includes("hero")) return;
          if (urlLower.includes("background")) return;
          if (urlLower.includes("cover")) return;
          if (urlLower.includes("slider")) return;
          if (urlLower.includes("slide")) return;

          // Penalize generic image names (likely not logos)
          // Extract just the filename
          const filename = url.split("/").pop()?.split("?")[0] || "";
          const filenameLower = filename.toLowerCase();

          // Very generic names should be deprioritized
          if (filenameLower.match(/^image[-_]?\d*\.(jpg|jpeg|png|webp)$/i)) {
            priority -= 80; // Heavy penalty for "image.png" or "image-123.png"
            source += ' (generic name: "image")';
          }
          if (filenameLower.match(/^img[-_]?\d*\.(jpg|jpeg|png|webp)$/i)) {
            priority -= 80;
            source += ' (generic name: "img")';
          }
          if (filenameLower.match(/^photo[-_]?\d*\.(jpg|jpeg|png|webp)$/i)) {
            priority -= 70;
            source += ' (generic name: "photo")';
          }

          // STRONG BONUS for logo-related filenames
          if (filenameLower.includes("logo")) {
            priority += 50; // Strong preference for files with "logo" in name
            source += ' (filename contains "logo")';
          }
          if (filenameLower.includes("brand")) {
            priority += 25;
            source += ' (filename contains "brand")';
          }

          // Skip VERY large dimension patterns (hero images)
          if (url.match(/[w_](1[5-9]\d{2,}|[2-9]\d{3,})/i)) return; // Width > 1500px
          if (url.match(/[h_](1[0-9]\d{2,}|[2-9]\d{3,})/i)) return; // Height > 1000px

          // Get dimensions from HTML attributes
          let width = parseInt($elem.attr("width") || "0");
          let height = parseInt($elem.attr("height") || "0");

          // If not in HTML, try to extract from URL
          if (!width || !height) {
            const urlDims = extractDimensionsFromUrl(url);
            width = urlDims.width || width;
            height = urlDims.height || height;
          }

          // CRITICAL: Reject banner-sized images (too wide for logos)
          // Typical logos are roughly square or slightly horizontal (max 3:1 ratio)
          // Banners are very wide (2:1 or more)
          if (width > 0 && height > 0) {
            const aspectRatio = width / height;
            if (aspectRatio > 4) {
              // Very wide banner-like image
              return;
            }
            if (width > 800) {
              // Too wide for a typical logo
              priority -= 100;
              source += ` (too wide: ${width}px)`;
            }
            if (height > 400) {
              // Too tall for a typical logo
              priority -= 80;
              source += ` (too tall: ${height}px)`;
            }
          }

          // Extract dimensions from filename patterns (e.g., image-1024x533.png)
          const filenameDimMatch = url.match(
            /[-_](\d{3,4})x(\d{3,4})\.(jpg|jpeg|png|svg|webp)/i
          );
          if (filenameDimMatch) {
            const fileWidth = parseInt(filenameDimMatch[1]);
            const fileHeight = parseInt(filenameDimMatch[2]);

            // Use filename dimensions if we don't have them yet
            if (!width) width = fileWidth;
            if (!height) height = fileHeight;

            // Check aspect ratio from filename
            if (fileWidth > 0 && fileHeight > 0) {
              const fileAspectRatio = fileWidth / fileHeight;
              if (fileAspectRatio > 4 || fileWidth > 800 || fileHeight > 400) {
                // Banner-sized image in filename
                return;
              }
            }
          }

          // FILTER OUT SMALL LOGOS (likely favicons)
          // Reject images smaller than 80px - these are almost never real logos
          if (width > 0 && width < 80) {
            return; // Hard reject - too small to be a real logo
          }
          if (height > 0 && height < 80) {
            return; // Hard reject - too small to be a real logo
          }

          // Penalize slightly small images (80-120px)
          if (width > 0 && width < 120) {
            priority -= 40;
            source += ` (small: ${width}px wide)`;
          }
          if (height > 0 && height < 120) {
            priority -= 40;
            source += ` (small: ${height}px tall)`;
          }

          // BONUS for appropriately sized logos (100-500px range)
          if (width >= 100 && width <= 500) {
            priority += 15;
          }
          if (height >= 100 && height <= 300) {
            priority += 15;
          }

          // Skip if priority dropped too low
          if (priority < 0) return;

          candidates.push({
            url,
            priority,
            source,
            width: width || undefined,
            height: height || undefined,
          });
        } catch (e) {
          // Invalid URL, skip
        }
      };

      // Strategy 1: WordPress custom logo (HIGHEST PRIORITY)
      // WordPress sites use img.custom-logo for the primary logo
      const wpCustomLogo = $("img.custom-logo");
      if (wpCustomLogo.length > 0) {
        addCandidate(
          wpCustomLogo.first(),
          120,
          "WordPress custom-logo (img.custom-logo)"
        );
      }

      // Strategy 1a: ALL IMAGES in header/nav (company name matching)
      // This catches logos that DON'T have "logo" in their attributes
      // E.g., "Fri-bevegelse.png" without any "logo" keyword
      $(
        'header img, nav img, .header img, .navbar img, [role="banner"] img'
      ).each((i, elem) => {
        if (i < 10) {
          // Check first 10 images in header
          const $img = $(elem);
          const src = (
            $img.attr("src") ||
            $img.attr("data-src") ||
            ""
          ).toLowerCase();
          const filename = src.split("/").pop()?.split("?")[0] || "";

          // Extract company name tokens
          const companyTokens = companyName
            .toLowerCase()
            .replace(/\\b(as|asa|ab|ba)\\b/gi, "") // Remove company suffixes
            .replace(/[^a-zæøå0-9\\s]/g, " ")
            .split(/\\s+/)
            .filter((t: string) => t.length >= 3);

          // Count how many company tokens match in the filename
          const matchingTokens = companyTokens.filter((token: string) =>
            filename.includes(token)
          );

          // Base priority for header images
          let priority = 100 - i * 5; // First image: 100, second: 95, etc.
          let source = `header img #${i + 1}`;

          // HUGE boost if filename contains company name tokens
          if (matchingTokens.length > 0) {
            priority += 50 * matchingTokens.length; // +50 per matching token
            source += ` (matches: ${matchingTokens.join(", ")})`;
          }

          // Boost for "logo" keyword
          if (src.includes("logo")) {
            priority += 30;
            source += ' (has "logo")';
          }

          // Boost if inside homepage link
          const $parent = $img.closest("a");
          const href = $parent.attr("href")?.toLowerCase() || "";
          if (
            href === "/" ||
            href === "./" ||
            href.includes(websiteUrl.toLowerCase())
          ) {
            priority += 25;
            source += " (in homepage link)";
          }

          // Penalize third-party/agency logos
          if (
            src.includes("teamrobin") ||
            src.includes("rob-logo") ||
            src.includes("gulesider")
          ) {
            priority -= 200;
            source += " (third-party agency logo)";
          }

          addCandidate(elem, priority, source);
        }
      });

      // Strategy 1b: FIRST image in the very top of the page (header/nav)
      // Logos are almost ALWAYS the first or second image in header
      const firstHeaderImages = $(
        'header img, nav img, .header img, .navbar img, [role="banner"] img'
      );
      firstHeaderImages.slice(0, 3).each((i, elem) => {
        const $img = $(elem);
        const src = $img.attr("src") || $img.attr("data-src") || "";
        const srcLower = src.toLowerCase();
        const alt = ($img.attr("alt") || "").toLowerCase();
        const className = ($img.attr("class") || "").toLowerCase();

        // If it contains "logo" in filename, src, alt, or class - HIGHEST priority
        if (
          srcLower.includes("logo") ||
          alt.includes("logo") ||
          className.includes("logo")
        ) {
          addCandidate(
            elem,
            125 - i * 2,
            `First ${i + 1} image in header WITH logo indicator`
          );
        } else {
          // First few images in header still get high priority (likely the logo)
          addCandidate(
            elem,
            118 - i * 3,
            `First ${i + 1} image in header (prime logo position)`
          );
        }
      });

      // Strategy 1c: First link in header (often wraps the logo)
      const firstHeaderLink = $(
        "header a, nav a, .header a, .navbar a"
      ).first();
      if (firstHeaderLink.length > 0) {
        const firstLinkImg = firstHeaderLink.find("img").first();
        if (firstLinkImg.length > 0) {
          addCandidate(
            firstLinkImg,
            115,
            "First link in header (common logo position)"
          );
        }
      }

      // Strategy 2: Look for explicit logo elements in HEADER/NAV ONLY
      // Do NOT search footer to avoid website creator logos
      const explicitLogoSelectors = [
        // Header/Nav logos (highest priority)
        {
          selector: 'header img[class*="logo" i], nav img[class*="logo" i]',
          priority: 110,
        },
        {
          selector: 'header img[id*="logo" i], nav img[id*="logo" i]',
          priority: 105,
        },
        {
          selector: 'header img[alt*="logo" i], nav img[alt*="logo" i]',
          priority: 100,
        },
        {
          selector: 'header a[class*="logo" i] img, nav a[class*="logo" i] img',
          priority: 100,
        },
        { selector: 'img[class*="logo" i][class*="header" i]', priority: 95 },

        // Page-wide logo elements OUTSIDE footer (search main content area)
        {
          selector: 'main img[id*="logo" i], article img[id*="logo" i]',
          priority: 90,
        },
        {
          selector: 'main img[class*="logo" i], article img[class*="logo" i]',
          priority: 85,
        },
        {
          selector: 'main img[alt*="logo" i], article img[alt*="logo" i]',
          priority: 80,
        },
        {
          selector: 'main img[src*="logo" i], article img[src*="logo" i]',
          priority: 78,
        },
        {
          selector: 'main [class*="logo" i] img, article [class*="logo" i] img',
          priority: 75,
        },
        {
          selector:
            'main a[class*="logo" i] img, article a[class*="logo" i] img',
          priority: 75,
        },
        { selector: ".logo img, #logo img", priority: 70 },

        // Brand elements (header/nav and main content only)
        {
          selector: 'header [class*="brand" i] img, nav [class*="brand" i] img',
          priority: 65,
        },
        {
          selector:
            'main [class*="brand" i] img, article [class*="brand" i] img',
          priority: 60,
        },
        { selector: 'img[class*="brand" i]', priority: 58 },
      ];

      for (const { selector, priority } of explicitLogoSelectors) {
        $(selector).each((i, elem) => {
          if (i < 5) {
            // Check first 5 matches per selector (increased from 3)
            addCandidate(elem, priority, `selector: ${selector}`);
          }
        });
      }

      // Strategy 3: Header/Nav images (only if they look like logos)
      $("header img, nav img").each((i, elem) => {
        if (i < 5) {
          // Check first 5 images in header/nav
          const $img = $(elem);
          const alt = ($img.attr("alt") || "").toLowerCase();
          const className = ($img.attr("class") || "").toLowerCase();

          // Higher priority if alt/class suggests it's a logo
          if (
            alt.includes("logo") ||
            className.includes("logo") ||
            alt.includes("brand") ||
            className.includes("brand")
          ) {
            addCandidate(elem, 60, "header/nav with logo-like attributes");
          } else {
            addCandidate(elem, 35, "header/nav image");
          }
        }
      });

      // Strategy 4: Inline SVG logos (common for modern websites)
      // Note: These cannot be extracted as URLs, just note their presence
      const svgLogos = $(
        'header svg[class*="logo" i], nav svg[class*="logo" i], footer svg[class*="logo" i], header svg[id*="logo" i], nav svg[id*="logo" i], footer svg[id*="logo" i]'
      );
      if (svgLogos.length > 0) {
        console.log(
          `ℹ️ Found ${svgLogos.length} inline SVG logo(s) in header/nav/footer (cannot extract as URL)`
        );
        // Could potentially convert SVG to data URI, but that's complex
      }

      // Strategy 5: Favicon as LAST RESORT (very low priority)
      // Store favicons separately to only use if no other logo candidates exist
      const faviconCandidates: typeof candidates = [];
      const faviconSelectors = [
        'link[rel="apple-touch-icon"]', // Often larger than regular favicon
        'link[rel="icon"][sizes*="192"]', // Larger favicons
        'link[rel="icon"][sizes*="256"]',
        'link[rel="icon"][type="image/png"]',
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
      ];

      for (const selector of faviconSelectors) {
        const $link = $(selector).first();
        if ($link.length) {
          const href = $link.attr("href");
          if (href) {
            try {
              const url = new URL(href, baseUrl.origin).href;
              const sizes = $link.attr("sizes");

              // Favicons get very low priority (only used if nothing else found)
              let priority = -50; // Negative by default - won't be used unless it's the only option

              // Only apple-touch-icon or large favicons get slightly better priority
              if (sizes) {
                const size = parseInt(sizes.split("x")[0] || "0");
                if (size >= 192) priority = -10; // Still negative, but less so
              }
              if (selector.includes("apple-touch-icon")) {
                priority = -5; // Apple touch icons are slightly better
              }

              faviconCandidates.push({
                url,
                priority,
                source: `favicon: ${selector}`,
                width: undefined,
                height: undefined,
              });
            } catch (e) {
              // Invalid URL
            }
            break; // Only take first favicon match
          }
        }
      }

      // Strategy 6: Open Graph image as LAST RESORT (very low priority)
      // OG images are often hero images, not logos
      const ogImage = $('meta[property="og:image"]').attr("content");
      if (ogImage) {
        try {
          const url = new URL(ogImage, baseUrl.origin).href;
          const urlLower = url.toLowerCase();
          const urlDims = extractDimensionsFromUrl(url);

          // Only use og:image if it has "logo" in the URL or is reasonably sized
          let priority = -30; // Very low priority by default
          if (urlLower.includes("logo")) {
            priority = 5; // Slightly better if it has "logo" in the name
          } else if (
            urlDims.width &&
            urlDims.width >= 200 &&
            urlDims.width <= 600
          ) {
            priority = -15; // Still negative, but less so
          }

          candidates.push({
            url,
            priority,
            source: "og:image",
            width: urlDims.width,
            height: urlDims.height,
          });
        } catch (e) {
          // Invalid URL
        }
      }

      // Sort candidates by priority (highest first)
      candidates.sort((a, b) => b.priority - a.priority);

      // Only use favicons if we have no positive-priority candidates
      const hasRealLogoCandidates = candidates.some((c) => c.priority > 0);
      if (!hasRealLogoCandidates && faviconCandidates.length > 0) {
        console.log(
          "⚠️ No logo candidates found, considering favicons as last resort..."
        );
        candidates.push(...faviconCandidates);
        candidates.sort((a, b) => b.priority - a.priority);
      }

      console.log("\n=== Logo Candidates Found ===");
      const topCandidates = candidates
        .filter((c) => c.priority > 0)
        .slice(0, 5);
      if (topCandidates.length === 0 && candidates.length > 0) {
        console.log(
          "⚠️ Only low-priority candidates (favicons/og:image) found:"
        );
        candidates.slice(0, 3).forEach((c, i) => {
          const dims =
            c.width && c.height
              ? ` [${c.width}x${c.height}]`
              : c.width
              ? ` [${c.width}px wide]`
              : "";
          console.log(`${i + 1}. [Priority ${c.priority}]${dims} ${c.source}`);
          console.log(
            `   URL: ${c.url.substring(0, 100)}${
              c.url.length > 100 ? "..." : ""
            }`
          );
        });
      } else {
        topCandidates.forEach((c, i) => {
          const dims =
            c.width && c.height
              ? ` [${c.width}x${c.height}]`
              : c.width
              ? ` [${c.width}px wide]`
              : "";
          console.log(`${i + 1}. [Priority ${c.priority}]${dims} ${c.source}`);
          console.log(
            `   URL: ${c.url.substring(0, 100)}${
              c.url.length > 100 ? "..." : ""
            }`
          );
        });
      }
      console.log("============================\n");

      // Filter to only positive-priority candidates for return
      const validCandidates = candidates.filter((c) => c.priority > 0);

      // Return the highest priority candidate (must have positive priority)
      if (validCandidates.length > 0) {
        const winner = validCandidates[0];
        const dims =
          winner.width && winner.height
            ? ` (${winner.width}x${winner.height})`
            : "";
        console.log(`✅ LOGO FOUND via DOM inspection:`);
        console.log(`   Source: ${winner.source}`);
        console.log(`   Priority: ${winner.priority}`);
        console.log(`   Dimensions: ${dims || "unknown"}`);
        console.log(`   URL: ${winner.url}`);
        return {
          logoUrl: winner.url,
          candidates: validCandidates.slice(0, 5), // Return top 5 for AI to review
        };
      }

      console.log(
        "⚠️ No quality logo candidates found (only favicons/low-quality images available)"
      );

      // Still return candidates even if none have positive priority
      // AI might make a better choice than our heuristics
      return {
        logoUrl: "",
        candidates: candidates.slice(0, 5).map((c) => ({
          url: c.url,
          source: c.source,
          priority: c.priority,
        })),
      };
    } catch (error: any) {
      console.error("Logo scraping failed:", error.message);
      return { logoUrl: "", candidates: [] };
    }
  }

  async scrapeWebsiteForContact(websiteUrl: string): Promise<{
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
        return (
          last8.length === 8 && (last8.startsWith("4") || last8.startsWith("9"))
        );
      };

      // Prefer mobile numbers first (often the most direct/personal).
      let contactPhone = phones.find(isNorwegianMobile) || phones[0] || "";

      console.log(
        `Found ${emails.length} emails and ${phones.length} phones on website`
      );

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
    let logoUrl = "";

    // If we found a website, scrape it for contact info and logo
    if (website) {
      try {
        const websiteInfo = await this.scrapeWebsiteForContact(website);
        contactEmail = websiteInfo.email;
        contactPhone = websiteInfo.phone;
        observations = websiteInfo.observations;

        // Store website content for potential OpenAI analysis
        (this as any).lastWebsiteContent = websiteInfo.websiteContent;

        // Find logo using AI first, then fall back to scraping
        logoUrl = await this.findCompanyLogo(proffInfo.companyName, website);
        if (logoUrl) {
          console.log("✅ Logo URL found:", logoUrl);
        } else {
          console.log("⚠️ No logo found");
        }
      } catch (error) {
        console.error("Failed to scrape website:", error);
      }
    }

    // IMPORTANT: Never guess a website URL. If Proff doesn't list it, we leave it empty
    // and let the controller perform a verified web-search lookup.

    return {
      companyName: proffInfo.companyName,
      styretsleder: proffInfo.styretsleder || "",
      address: proffInfo.address || "",
      city: proffInfo.city || "",
      website,
      contactEmail,
      contactPhone,
      observations,
      logoUrl,
    };
  }

  getLastWebsiteContent(): string {
    return (this as any).lastWebsiteContent || "";
  }

  /**
   * Scrape Proff.no search results page
   * Returns array of companies with name and Proff URL
   */
  async scrapeProffSearchResults(searchUrl: string): Promise<
    Array<{
      id: string;
      companyName: string;
      proffUrl: string;
      organizationNumber?: string;
      industry?: string;
      employees?: string;
      revenue?: string;
    }>
  > {
    try {
      console.log("🔍 Scraping Proff search results:", searchUrl);

      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const companies: Array<{
        id: string;
        companyName: string;
        proffUrl: string;
        organizationNumber?: string;
        industry?: string;
        employees?: string;
        revenue?: string;
      }> = [];

      // Proff.no uses different structures - try multiple selectors
      const possibleSelectors = [
        ".hit-wrapper",
        ".company-item",
        ".search-hit",
        ".company-row",
        ".result-item",
        "article",
        ".list-item",
        "[data-company]",
        "tr[data-id]",
        ".company-list-item",
      ];

      let foundItems = false;

      for (const selector of possibleSelectors) {
        const items = $(selector);
        if (items.length > 0) {
          console.log(
            `✅ Found ${items.length} items with selector: ${selector}`
          );

          items.each((index, element) => {
            const $el = $(element);

            // Try to find company name and link
            let nameLink = $el.find("a[href*='/selskap/']").first();
            if (!nameLink.length) {
              nameLink = $el.find("a").first();
            }

            const companyName = nameLink.text().trim();
            let proffUrl = nameLink.attr("href") || "";

            // Ensure full URL
            if (proffUrl && !proffUrl.startsWith("http")) {
              proffUrl = `https://www.proff.no${proffUrl}`;
            }

            // Only add if we have valid data
            if (companyName && proffUrl && proffUrl.includes("proff.no")) {
              // Extract organization number from URL
              const orgNumberMatch = proffUrl.match(/\/(\d{9})\//);
              const organizationNumber = orgNumberMatch
                ? orgNumberMatch[1]
                : "";

              const id = organizationNumber || companyName;

              companies.push({
                id,
                companyName,
                proffUrl,
                organizationNumber,
              });
            }
          });

          if (companies.length > 0) {
            foundItems = true;
            break;
          }
        }
      }

      if (!foundItems) {
        console.log(
          "⚠️ No items found with any selector. Trying generic link search..."
        );

        // Fallback: find all links to company pages
        $("a[href*='/selskap/']").each((index, element) => {
          if (companies.length >= 50) return; // Limit to prevent too many results

          const $link = $(element);
          const companyName = $link.text().trim();
          let proffUrl = $link.attr("href") || "";

          if (proffUrl && !proffUrl.startsWith("http")) {
            proffUrl = `https://www.proff.no${proffUrl}`;
          }

          if (companyName && proffUrl && companyName.length > 2) {
            const orgNumberMatch = proffUrl.match(/\/(\d{9})\//);
            const organizationNumber = orgNumberMatch ? orgNumberMatch[1] : "";
            const id = organizationNumber || companyName;

            // Check if not already added
            if (!companies.some((c) => c.id === id)) {
              companies.push({
                id,
                companyName,
                proffUrl,
                organizationNumber,
              });
            }
          }
        });
      }

      console.log(`✅ Found ${companies.length} companies in search results`);

      // Log first few for debugging
      if (companies.length > 0) {
        console.log("First 3 companies:");
        companies.slice(0, 3).forEach((c) => {
          console.log(`  - ${c.companyName} (${c.proffUrl})`);
        });
      }

      return companies;
    } catch (error: any) {
      console.error("Failed to scrape Proff search results:", error.message);
      return [];
    }
  }
}
