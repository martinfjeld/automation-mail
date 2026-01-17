import React, { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./HistoryPanel.module.scss";
import { API_URL, LOCAL_API_URL } from "../../config";
import AlertModal from "../AlertModal/AlertModal";

interface HistoryEntry {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  website: string;
  address?: string;
  city?: string;
  service: string;
  notionPageId: string;
  sanityPresentationId?: string;
  presentationUrl?: string;
  createdAt: string;
  updatedAt: string;
  emailContent?: string;
  contactPersonUrl?: string;
  industry?: string;
  desktopScreenshot?: string;
  mobileScreenshot?: string;
  sanityUniqueId?: string;
  hasScreenshots?: boolean;
  logoUrl?: string;
  automationIndustry?: string;
  automationText1?: string;
  automationText2?: string;
  imagesGenerated?: boolean;
  emailSent?: boolean;
  leadStatus?: string;
  meetingDates?: string[];
  bookingLinks?: string[];
}

interface HistoryPanelProps {
  onLoadEntry?: (entry: HistoryEntry) => void;
  currentEntryId?: string;
  onDeleteCurrentEntry?: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  onLoadEntry,
  currentEntryId,
  onDeleteCurrentEntry,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState(() => {
    const saved = localStorage.getItem("historyPanel_searchQuery");
    return saved || "";
  });
  const [filterIndustry, setFilterIndustry] = useState<string>(() => {
    const saved = localStorage.getItem("historyPanel_filterIndustry");
    return saved || "all";
  });
  const [filterService, setFilterService] = useState<string>(() => {
    const saved = localStorage.getItem("historyPanel_filterService");
    return saved || "all";
  });
  const [filterEmailSent, setFilterEmailSent] = useState<string>(() => {
    const saved = localStorage.getItem("historyPanel_filterEmailSent");
    return saved || "notSent";
  });
  const [filterImagesGenerated, setFilterImagesGenerated] = useState<string>(
    () => {
      const saved = localStorage.getItem("historyPanel_filterImagesGenerated");
      return saved || "noMockups";
    }
  );

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("historyPanel_searchQuery", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem("historyPanel_filterIndustry", filterIndustry);
  }, [filterIndustry]);

  useEffect(() => {
    localStorage.setItem("historyPanel_filterService", filterService);
  }, [filterService]);

  useEffect(() => {
    localStorage.setItem("historyPanel_filterEmailSent", filterEmailSent);
  }, [filterEmailSent]);

  useEffect(() => {
    localStorage.setItem(
      "historyPanel_filterImagesGenerated",
      filterImagesGenerated
    );
  }, [filterImagesGenerated]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${LOCAL_API_URL}/api/history`);
      const data = await response.json();

      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, companyName: string) => {
    // Show custom modal instead of browser confirm
    setDeleteTarget({ id, name: companyName });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const { id, name: companyName } = deleteTarget;

    // Hide modal and show spinner immediately
    setShowDeleteModal(false);
    setDeleting(id);

    // If this is the currently loaded entry, trigger the spinner in parent
    if (currentEntryId === id && onDeleteCurrentEntry) {
      onDeleteCurrentEntry();
    }

    try {
      // Try to delete from local first (handles Sanity image cleanup)
      try {
        const localResponse = await fetch(
          `${LOCAL_API_URL}/api/history/${id}`,
          {
            method: "DELETE",
          }
        );

        const localData = await localResponse.json();

        if (localData.success) {
          console.log("✅ Deleted from local (Sanity images cleaned up)");
        } else {
          console.warn("⚠️ Local deletion failed:", localData.error);
        }
      } catch (localError) {
        console.warn("⚠️ Could not delete from local:", localError);
        // Continue anyway - might be out of sync
      }

      // Always delete from production regardless of local success
      const prodResponse = await fetch(`${API_URL}/api/history/${id}`, {
        method: "DELETE",
      });

      const prodData = await prodResponse.json();

      if (prodData.success) {
        // Remove from local state
        setHistory(history.filter((entry) => entry.id !== id));
      } else {
        setErrorMessage(`Failed to delete from production: ${prodData.error}`);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
      setErrorMessage("Failed to delete entry. Check console for details.");
      setShowErrorModal(true);
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter history based on search query and filters (memoized to prevent recalculation)
  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      // Search filter - search in company name, contact person, email, city
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        entry.companyName.toLowerCase().includes(searchLower) ||
        entry.contactPerson.toLowerCase().includes(searchLower) ||
        entry.email.toLowerCase().includes(searchLower) ||
        (entry.city && entry.city.toLowerCase().includes(searchLower)) ||
        (entry.address && entry.address.toLowerCase().includes(searchLower));

      // Industry filter - use automationIndustry which has consistent values (Bygg, Helse, Advokat)
      const matchesIndustry =
        filterIndustry === "all" ||
        (entry.automationIndustry &&
          entry.automationIndustry.toLowerCase() ===
            filterIndustry.toLowerCase());

      // Service filter
      const matchesService =
        filterService === "all" || entry.service === filterService;

      // Email sent filter
      const matchesEmailSent =
        filterEmailSent === "all" ||
        (filterEmailSent === "sent" && entry.emailSent === true) ||
        (filterEmailSent === "notSent" && !entry.emailSent);

      // Images generated filter
      const matchesImagesGenerated =
        filterImagesGenerated === "all" ||
        (filterImagesGenerated === "hasMockups" &&
          entry.imagesGenerated === true) ||
        (filterImagesGenerated === "noMockups" && !entry.imagesGenerated);

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesService &&
        matchesEmailSent &&
        matchesImagesGenerated
      );
    });
  }, [
    history,
    searchQuery,
    filterIndustry,
    filterService,
    filterEmailSent,
    filterImagesGenerated,
  ]);

  return (
    <>
      {/* Floating Button */}
      <button
        className={`${styles.floatingButton} ${isOpen ? styles.open : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close history" : "View history"}
      >
        {isOpen ? "✕" : "📋"}
      </button>

      {/* Sliding Panel */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}>
        <div className={styles.topSection}>
          <div className={styles.header}>
            <div className={styles.titleContainer}>
              <h2 className={styles.title}>Generated Emails</h2>
              <span className={styles.entryCount}>
                {filteredHistory.length}{" "}
                {filteredHistory.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <button
              className={styles.refreshButton}
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh history"
            >
              {loading ? "⟳" : "↻"}
            </button>
          </div>

          {/* Search and Filter Section */}
          <div className={styles.filterSection}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search company, contact, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className={styles.filterRow}>
              <select
                className={styles.filterSelect}
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
              >
                <option value="all">All Industries</option>
                <option value="helse">Helse</option>
                <option value="bygg">Bygg</option>
                <option value="advokat">Advokat</option>
              </select>

              <select
                className={styles.filterSelect}
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
              >
                <option value="all">All Services</option>
                <option value="Web">Web</option>
                <option value="Video">Video</option>
                <option value="Images">Images</option>
                <option value="Branding">Branding</option>
              </select>
            </div>

            <div className={styles.filterRow}>
              <select
                className={styles.filterSelect}
                value={filterEmailSent}
                onChange={(e) => setFilterEmailSent(e.target.value)}
              >
                <option value="all">All Emails</option>
                <option value="sent">Sent</option>
                <option value="notSent">Not Sent</option>
              </select>

              <select
                className={styles.filterSelect}
                value={filterImagesGenerated}
                onChange={(e) => setFilterImagesGenerated(e.target.value)}
              >
                <option value="all">All Mockups</option>
                <option value="hasMockups">Has Mockups</option>
                <option value="noMockups">No Mockups</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {loading && history.length === 0 ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className={styles.empty}>
              {searchQuery ||
              filterIndustry !== "all" ||
              filterService !== "all" ||
              filterEmailSent !== "all" ||
              filterImagesGenerated !== "all"
                ? "No matches found"
                : "No history yet"}
            </div>
          ) : (
            <ul className={styles.list}>
              {filteredHistory.map((entry) => (
                <li
                  key={entry.id}
                  className={styles.item}
                  onClick={() => {
                    if (onLoadEntry) {
                      onLoadEntry(entry);
                      setIsOpen(false);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.itemHeader}>
                    <h3 className={styles.companyName}>{entry.companyName}</h3>
                    <div className={styles.badgesContainer}>
                      <div className={styles.badges}>
                        <span className={styles.service}>{entry.service}</span>
                        {entry.emailSent && (
                          <span className={styles.emailSentBadge}>✉️ Sent</span>
                        )}
                        {entry.imagesGenerated && (
                          <span className={styles.mockupBadge}>
                            💻 Generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.itemDetailsContainer}>
                    <div className={styles.itemDetails}>
                      <div className={styles.detail}>
                        <strong>Contact:</strong> {entry.contactPerson}
                      </div>
                      <div className={styles.detail}>
                        <strong>Email:</strong> {entry.email}
                      </div>
                      {entry.phone && (
                        <div className={styles.detail}>
                          <strong>Phone:</strong> {entry.phone}
                        </div>
                      )}
                      <div className={styles.detail}>
                        <strong>Created:</strong> {formatDate(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    {entry.presentationUrl && (
                      <a
                        href={entry.presentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkButton}
                      >
                        <span>View Presentation</span>
                      </a>
                    )}
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(entry.id, entry.companyName)}
                      disabled={deleting === entry.id}
                    >
                      {deleting === entry.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)} />
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        isOpen={showDeleteModal && deleteTarget !== null}
        title="Bekreft sletting"
        message={
          <>
            Er du sikker på at du vil slette{" "}
            <strong>{deleteTarget?.name}</strong>?
          </>
        }
        warning="Dette vil fjerne oppføringen fra Notion, Sanity og historikk."
        disclaimer="Denne handlingen kan ikke angres"
        confirmText="Slett"
        cancelText="Avbryt"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
        confirmButtonStyle="danger"
      />

      {/* Error Alert Modal */}
      <AlertModal
        isOpen={showErrorModal}
        title="Feil"
        message={errorMessage}
        confirmText="OK"
        onConfirm={() => setShowErrorModal(false)}
        confirmButtonStyle="light"
      />
    </>
  );
};

export default React.memo(HistoryPanel);
