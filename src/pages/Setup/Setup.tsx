import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Setup.module.scss";
import { API_URL } from "../../config";

interface SetupStatus {
  isSetupComplete: boolean;
  missingKeys: string[];
  availableKeys: {
    OPENAI_API_KEY: boolean;
    NOTION_TOKEN: boolean;
    NOTION_DATABASE_ID: boolean;
    SCRAPING_API_KEY: boolean;
  };
}

const Setup: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [keys, setKeys] = useState({
    OPENAI_API_KEY: "",
    NOTION_TOKEN: "",
    NOTION_DATABASE_ID: "",
    SCRAPING_API_KEY: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/setup/status`);
      const data = await response.json();
      setStatus(data);

      // If setup is complete, redirect to main app
      if (data.isSetupComplete) {
        setTimeout(() => navigate("/"), 2000);
      }
    } catch (error) {
      console.error("Failed to check setup status:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_URL}/api/setup/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(keys),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(
          "All credentials validated successfully! Redirecting..."
        );
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        setErrors(data.errors || {});
      }
    } catch (error) {
      setErrors({
        general: "Failed to validate credentials. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setKeys((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className={styles.setup}>
        <div className={styles.card}>
          <h1 className={styles.title}>Checking setup status...</h1>
        </div>
      </div>
    );
  }

  if (status?.isSetupComplete) {
    return (
      <div className={styles.setup}>
        <div className={styles.card}>
          <h1 className={styles.title}>✅ Setup Complete!</h1>
          <p className={styles.description}>Redirecting to main app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.setup}>
      <div className={styles.card}>
        <h1 className={styles.title}>🔐 Initial Setup</h1>
        <p className={styles.description}>
          Please provide the required API keys to get started. All keys are
          stored securely server-side.
        </p>

        {successMessage && (
          <div className={styles.success}>{successMessage}</div>
        )}

        {errors.general && <div className={styles.error}>{errors.general}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* OpenAI API Key */}
          <div className={styles.field}>
            <label className={styles.label}>
              OpenAI API Key *
              <span className={styles.hint}>
                Get from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI Platform
                </a>
              </span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={keys.OPENAI_API_KEY}
              onChange={(e) =>
                handleInputChange("OPENAI_API_KEY", e.target.value)
              }
              placeholder="sk-..."
              required
              disabled={status?.availableKeys.OPENAI_API_KEY}
            />
            {status?.availableKeys.OPENAI_API_KEY && (
              <span className={styles.validated}>✓ Already configured</span>
            )}
            {errors.OPENAI_API_KEY && (
              <span className={styles.fieldError}>{errors.OPENAI_API_KEY}</span>
            )}
          </div>

          {/* Notion Token */}
          <div className={styles.field}>
            <label className={styles.label}>
              Notion Integration Token *
              <span className={styles.hint}>
                Get from{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Notion Integrations
                </a>
              </span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={keys.NOTION_TOKEN}
              onChange={(e) =>
                handleInputChange("NOTION_TOKEN", e.target.value)
              }
              placeholder="secret_..."
              required
              disabled={status?.availableKeys.NOTION_TOKEN}
            />
            {status?.availableKeys.NOTION_TOKEN && (
              <span className={styles.validated}>✓ Already configured</span>
            )}
            {errors.NOTION && (
              <span className={styles.fieldError}>{errors.NOTION}</span>
            )}
          </div>

          {/* Notion Database ID */}
          <div className={styles.field}>
            <label className={styles.label}>
              Notion Database ID *
              <span className={styles.hint}>
                Copy from your Notion database URL
              </span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={keys.NOTION_DATABASE_ID}
              onChange={(e) =>
                handleInputChange("NOTION_DATABASE_ID", e.target.value)
              }
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
              disabled={status?.availableKeys.NOTION_DATABASE_ID}
            />
            {status?.availableKeys.NOTION_DATABASE_ID && (
              <span className={styles.validated}>✓ Already configured</span>
            )}
          </div>

          {/* Optional Scraping API Key */}
          <div className={styles.field}>
            <label className={styles.label}>
              Scraping API Key (Optional)
              <span className={styles.hint}>
                Optional: For enhanced scraping capabilities
              </span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={keys.SCRAPING_API_KEY}
              onChange={(e) =>
                handleInputChange("SCRAPING_API_KEY", e.target.value)
              }
              placeholder="Optional"
              disabled={status?.availableKeys.SCRAPING_API_KEY}
            />
            {status?.availableKeys.SCRAPING_API_KEY && (
              <span className={styles.validated}>✓ Already configured</span>
            )}
          </div>

          <button type="submit" className={styles.button} disabled={saving}>
            {saving ? "Validating..." : "Save & Test Credentials"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Setup;
