import React, { useState, useEffect } from "react";
import Button from "../../components/Button/Button";
import styles from "./Generator.module.scss";
import { API_URL } from "../../config";

interface GenerateResult {
  companyName: string;
  contactPerson: string;
  contactPersonUrl?: string;
  email: string;
  phone?: string;
  website: string;
  emailContent: string;
  notionPageId: string;
  industry?: string;
  desktopScreenshot?: string;
  mobileScreenshot?: string;
  sanityPresentationId?: string;
  hasScreenshots?: boolean;
}

const Generator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [proffUrl, setProffUrl] = useState("");
  const [service, setService] = useState("Web");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");
  const [editableEmail, setEditableEmail] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Detect screen size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Remove setup check - using .env directly
  useEffect(() => {
    setCheckingSetup(false);
  }, []);

  // Keep editable fields in sync with the latest generation result
  useEffect(() => {
    setEditableEmail(result?.email || "");
    setEditablePhone(result?.phone || "");
  }, [result]);

  // Auto-copy company name to clipboard when result loads
  useEffect(() => {
    if (result?.companyName) {
      navigator.clipboard.writeText(result.companyName).catch((err) => {
        console.warn("Failed to copy to clipboard:", err);
      });
    }
  }, [result]);

  // Auto-fetch screenshots when result loads with website
  useEffect(() => {
    if (
      result?.website &&
      !result.desktopScreenshot &&
      !result.mobileScreenshot &&
      !loadingScreenshots
    ) {
      handleGetScreenshots();
    }
  }, [result?.website]);

  const handleGenerate = async () => {
    if (!proffUrl) {
      setError("Please enter a Proff.no URL");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setPitchDeckUrl("");
    setEditableEmail("");
    setEditablePhone("");
    setLoadingStep("Initializing...");

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          proffUrl,
          service,
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.step) {
              setLoadingStep(data.step);
            } else if (data.success) {
              setResult(data.data);
            } else if (data.error) {
              setError(data.error);
            }
          }
        }
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleGetScreenshots = async () => {
    if (!result?.website) return;

    setLoadingScreenshots(true);
    try {
      const response = await fetch(`${API_URL}/api/screenshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          website: result.website,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          ...result,
          desktopScreenshot: data.data.desktopScreenshot,
          mobileScreenshot: data.data.mobileScreenshot,
        });
      } else {
        setError(data.error || "Failed to capture screenshots");
      }
    } catch (error) {
      setError("Failed to capture screenshots. Please try again.");
    } finally {
      setLoadingScreenshots(false);
    }
  };

  const buildEmailWithPitchDeck = (baseEmail: string, url: string) => {
    const cleanUrl = (url || "").trim();
    if (!cleanUrl) return baseEmail;

    const block =
      "Jeg har laget en pitch deck som kan åpnes direkte i nettleseren. Ingen nedlasting. Den viser et forslag til hvordan nye nettsider for dere kan se ut + et lite bilde av hvem vi er og hvordan vi jobber.\n" +
      cleanUrl;

    const closing = "Med vennlig hilsen,";
    const trimmed = (baseEmail || "").trimEnd();

    // Prefer inserting right before the required closing line.
    if (trimmed.endsWith(closing)) {
      const withoutClosing = trimmed
        .slice(0, trimmed.length - closing.length)
        .trimEnd();
      return `${withoutClosing}\n\n${block}\n\n${closing}`;
    }

    // Fallback: append block (best-effort) and keep the original content.
    return `${trimmed}\n\n${block}`;
  };

  const servicePhrase: Record<string, string> = {
    Video: "nye videoer",
    Images: "nye bilder",
    Web: "nye nettsider",
    Branding: "ny branding",
  };

  const composedEmailContent =
    result && service === "Web"
      ? buildEmailWithPitchDeck(result.emailContent, pitchDeckUrl)
      : result?.emailContent || "";

  const gmailComposeUrl = (() => {
    if (!result) return "";

    const subject = encodeURIComponent(
      `No Offence, men hva med ${servicePhrase[service] || service}?`
    );
    const body = encodeURIComponent(composedEmailContent);
    const to = encodeURIComponent(editableEmail || result.email || "");

    return `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${to}&su=${subject}&body=${body}`;
  })();

  const mailtoUrl = (() => {
    if (!result) return "";

    const subject = encodeURIComponent(
      `No Offence, men hva med ${servicePhrase[service] || service}?`
    );
    // For mailto, manually replace newlines with %0D%0A after encoding
    const body = encodeURIComponent(composedEmailContent).replace(
      /%0A/g,
      "%0D%0A"
    );
    const to = encodeURIComponent(editableEmail || result.email || "");

    return `mailto:${to}?subject=${subject}&body=${body}`;
  })();

  if (checkingSetup) {
    return (
      <div className={styles.generator}>
        <div className={styles.container}>
          <p>Checking setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.generator}>
      <div className={styles.container}>
        <h1 className={styles.title}>No Offence</h1>

        <p
          className={styles.subtitle}
          style={{
            fontSize: ".7rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "5px",
          }}
        >
          Salgsautomatisering™
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Proff.no Firma Link</label>
            <input
              type="url"
              className={styles.input}
              value={proffUrl}
              onChange={(e) => setProffUrl(e.target.value)}
              placeholder="https://www.proff.no/..."
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Velg tjeneste</label>
            <select
              className={styles.select}
              value={service}
              onChange={(e) => setService(e.target.value)}
              disabled={loading}
            >
              <option value="Web">Web - Ny eller forbedret nettside</option>
              <option value="Video">Video - Reklamefilm / Videoinnhold</option>
              <option value="Images">
                Images - Foto / Portretter / Visuelt innhold
              </option>
              <option value="Branding">
                Branding - Visuell identitet / Brand book
              </option>
            </select>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button
            onClick={handleGenerate}
            disabled={loading}
            loading={loading}
            loadingText={loadingStep}
          >
            Generate Email
          </Button>
        </div>

        {result && (
          <div className={styles.result}>
            <h2 className={styles.resultTitle}>Generated Email</h2>

            <div className={styles.info}>
              <div className={styles.infoItem}>
                <strong>Company:</strong> {result.companyName}
              </div>
              {result.contactPerson && (
                <div className={styles.infoItem}>
                  <strong>Contact:</strong>{" "}
                  {result.contactPersonUrl ? (
                    <a
                      href={result.contactPersonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {result.contactPerson}
                    </a>
                  ) : (
                    result.contactPerson
                  )}
                </div>
              )}
              {result.email && (
                <div className={styles.infoItem}>
                  <strong>Email:</strong>{" "}
                  <input
                    type="email"
                    className={styles.inlineEditable}
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}
              {result.phone && (
                <div className={styles.infoItem}>
                  <strong>Phone:</strong>{" "}
                  <input
                    type="tel"
                    className={styles.inlineEditable}
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}
              <div className={styles.infoItem}>
                <strong>Website:</strong>{" "}
                <a
                  href={result.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.website}
                </a>
              </div>
            </div>

            <textarea
              className={styles.textarea}
              value={composedEmailContent}
              readOnly
              rows={15}
            />

            {service === "Web" && (
              <div className={styles.info}>
                <div className={styles.infoItem}>
                  <strong>Pitch deck link (Web):</strong>{" "}
                  <input
                    type="url"
                    className={styles.input}
                    value={pitchDeckUrl}
                    onChange={(e) => setPitchDeckUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <Button
                variant="primary"
                onClick={() => {
                  navigator.clipboard.writeText(result.companyName);

                  // Open the specific Sanity presentation if it was created
                  if (result.sanityPresentationId) {
                    window.open(
                      `https://martinfjeldio.sanity.studio/structure/presentation;${result.sanityPresentationId}`,
                      "_blank"
                    );
                  } else {
                    // Fallback to creating a new presentation
                    window.open(
                      "https://martinfjeldio.sanity.studio/intent/create/template=presentation;type=presentation/",
                      "_blank"
                    );
                  }

                  // Determine Figma link based on industry
                  let figmaLink =
                    "https://www.figma.com/design/flUAGnA3eFksxhwcKYKxvo/Advokat/duplicate"; // Default - Lawyer
                  const industry = result.industry?.toLowerCase() || "";

                  if (industry.includes("bygg")) {
                    figmaLink =
                      "https://www.figma.com/design/SW1eCIjZ9tPsWPXCclkzm6/Byggebransjen/duplicate";
                  } else if (
                    industry.includes("helse") ||
                    industry.includes("aktivitet")
                  ) {
                    figmaLink =
                      "https://www.figma.com/design/R8u5EkdAp5NANKs0PX1Aor/Health/duplicate";
                  }

                  window.open(figmaLink, "_blank");
                }}
              >
                Open Figma Design
              </Button>
              {result.website && (
                <Button
                  variant="secondary"
                  disabled={
                    !result.desktopScreenshot || !result.mobileScreenshot
                  }
                  loading={loadingScreenshots}
                  loadingText="Capturing screenshots..."
                  onClick={() => {
                    if (result.desktopScreenshot) {
                      const desktopLink = document.createElement("a");
                      desktopLink.href = `data:image/png;base64,${result.desktopScreenshot}`;
                      desktopLink.download = `${result.companyName}_desktop.png`;
                      desktopLink.click();
                    }
                    if (result.mobileScreenshot) {
                      setTimeout(() => {
                        const mobileLink = document.createElement("a");
                        mobileLink.href = `data:image/png;base64,${result.mobileScreenshot}`;
                        mobileLink.download = `${result.companyName}_mobile.png`;
                        mobileLink.click();
                      }, 100);
                    }
                  }}
                >
                  Download Screenshots
                </Button>
              )}
              {result.email && (
                <Button
                  variant="secondary"
                  href={isMobile ? mailtoUrl : gmailComposeUrl}
                  target={isMobile ? undefined : "_blank"}
                  rel={isMobile ? undefined : "noopener noreferrer"}
                >
                  Open in Gmail
                </Button>
              )}
            </div>

            <div className={styles.success}>
              Entry created in Notion database
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
