import React, { useState, useEffect } from "react";
import Button from "../../components/Button/Button";
import styles from "./Generator.module.scss";

interface GenerateResult {
  companyName: string;
  contactPerson: string;
  contactPersonUrl?: string;
  email: string;
  phone?: string;
  website: string;
  emailContent: string;
  notionPageId: string;
}

const Generator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [proffUrl, setProffUrl] = useState("");
  const [service, setService] = useState("Video");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");
  const [editableEmail, setEditableEmail] = useState("");
  const [editablePhone, setEditablePhone] = useState("");

  // Remove setup check - using .env directly
  useEffect(() => {
    setCheckingSetup(false);
  }, []);

  // Keep editable fields in sync with the latest generation result
  useEffect(() => {
    setEditableEmail(result?.email || "");
    setEditablePhone(result?.phone || "");
  }, [result]);

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

    try {
      const response = await fetch("http://localhost:3001/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proffUrl,
          service,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || "Failed to generate email");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
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
      const withoutClosing = trimmed.slice(0, trimmed.length - closing.length).trimEnd();
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

  const handleCopyToClipboard = () => {
    if (result?.emailContent) {
      navigator.clipboard.writeText(composedEmailContent);
      alert("Email copied to clipboard!");
    }
  };

  const gmailComposeUrl = (() => {
    if (!result) return "";

    const subject = encodeURIComponent(
      `No Offence, men hva med ${servicePhrase[service] || service}?`
    );
    const body = encodeURIComponent(composedEmailContent);
    const to = encodeURIComponent(editableEmail || result.email || "");

    return `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${to}&su=${subject}&body=${body}`;
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
        <h1 className={styles.title}>Figma Automator</h1>
        <p className={styles.subtitle}>
          Generate personalized outreach emails for Norwegian companies
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Proff.no Company URL *</label>
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
            <label className={styles.label}>Service *</label>
            <select
              className={styles.select}
              value={service}
              onChange={(e) => setService(e.target.value)}
              disabled={loading}
            >
              <option value="Video">Video - Reklamefilm / Videoinnhold</option>
              <option value="Images">
                Images - Foto / Portretter / Visuelt innhold
              </option>
              <option value="Web">Web - Ny eller forbedret nettside</option>
              <option value="Branding">
                Branding - Visuell identitet / Brand book
              </option>
            </select>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Email"}
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
              <Button onClick={handleCopyToClipboard}>
                📋 Copy to Clipboard
              </Button>
              {result.email && gmailComposeUrl && (
                <Button
                  variant="secondary"
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📧 Open in Gmail
                </Button>
              )}
            </div>

            <div className={styles.success}>
              ✓ Entry created in Notion database
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;
