import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet";
import Button from "../../components/Button/Button";
import HistoryPanel from "../../components/HistoryPanel/HistoryPanel";
import AlertModal from "../../components/AlertModal/AlertModal";
import styles from "./Generator.module.scss";
import { API_URL, LOCAL_API_URL } from "../../config";
import trashIcon from "../../assets/image.png";

// ⏰ Target time for countdown (24-hour format)
const TARGET_HOUR = 16; // 16:00 (4 PM)
const TARGET_MINUTE = 0;

interface GenerateResult {
  companyName: string;
  contactPerson: string;
  contactPersonUrl?: string;
  email: string;
  phone?: string;
  website: string;
  address?: string;
  city?: string;
  emailContent: string;
  notionPageId: string;
  industry?: string;
  desktopScreenshot?: string;
  mobileScreenshot?: string;
  sanityPresentationId?: string;
  sanityUniqueId?: string;
  presentationUrl?: string;
  hasScreenshots?: boolean;
  logoUrl?: string;
  leadStatus?: string;
}

const RollingDigit: React.FC<{
  digit: string;
  index: number;
  timeKey: string;
}> = ({ digit, index, timeKey }) => {
  const rollerRef = useRef<HTMLSpanElement>(null);
  const prevTimeKeyRef = useRef<string>(timeKey);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!rollerRef.current || digit === ":" || digit === " ") return;

    const targetDigit = parseInt(digit);
    if (isNaN(targetDigit)) return;

    const digitHeight = 32; // Height of each digit in pixels
    const targetY = -targetDigit * digitHeight;

    // Check if time changed
    const timeChanged = prevTimeKeyRef.current !== timeKey;

    if (!initializedRef.current) {
      // First mount: set position immediately
      if (rollerRef.current) {
        rollerRef.current.style.transform = `translateY(${targetY}px)`;
      }
      initializedRef.current = true;
      prevTimeKeyRef.current = timeKey;
    } else if (timeChanged) {
      // Time changed: animate to new position
      if (rollerRef.current) {
        rollerRef.current.style.transition = `transform 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
        rollerRef.current.style.transitionDelay = `${index * 0.03}s`;
        rollerRef.current.style.transform = `translateY(${targetY}px)`;
      }
      prevTimeKeyRef.current = timeKey;
    }
  }, [timeKey, digit, index]);

  if (digit === ":" || digit === " ") {
    return <span className={styles.digitSeparator}>{digit}</span>;
  }

  return (
    <span className={styles.digitContainer}>
      <span className={styles.digitRoller} ref={rollerRef}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span key={num} className={styles.digit}>
            {num}
          </span>
        ))}
      </span>
    </span>
  );
};

const RollingClock: React.FC<{ time: Date }> = ({ time }) => {
  const timeString = time.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Use time as key to trigger animations
  const timeKey = timeString;

  return (
    <span className={styles.rollingClock}>
      {timeString.split("").map((char, index) => (
        <RollingDigit
          key={`${index}`}
          digit={char}
          index={index}
          timeKey={timeKey}
        />
      ))}
    </span>
  );
};

const RollingChar: React.FC<{
  char: string;
  index: number;
  textKey: string;
}> = ({ char, index, textKey }) => {
  const rollerRef = useRef<HTMLSpanElement>(null);
  const prevCharRef = useRef<string>(char);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!rollerRef.current) return;

    const allChars = "abcdefghijklmnopqrstuvwxyzæøå0123456789 ";
    const currentIndex = allChars.indexOf(char.toLowerCase());

    if (currentIndex === -1) {
      // Character not in our set, just display it
      return;
    }

    const charHeight = 20; // Height of each character in pixels
    const targetY = -currentIndex * charHeight;

    // Check if char changed
    const charChanged = prevCharRef.current !== char;

    if (!initializedRef.current) {
      // First mount: set position immediately
      if (rollerRef.current) {
        rollerRef.current.style.transform = `translateY(${targetY}px)`;
      }
      initializedRef.current = true;
      prevCharRef.current = char;
    } else if (charChanged) {
      // Char changed: animate to new position
      if (rollerRef.current) {
        rollerRef.current.style.transition = `transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
        rollerRef.current.style.transitionDelay = `${index * 0.04}s`;
        rollerRef.current.style.transform = `translateY(${targetY}px)`;
      }
      prevCharRef.current = char;
    }
  }, [char, index, textKey]);

  const allChars = "abcdefghijklmnopqrstuvwxyzæøå0123456789 ";

  return (
    <span className={styles.charContainer}>
      <span className={styles.charRoller} ref={rollerRef}>
        {allChars.split("").map((c, i) => (
          <span key={i} className={styles.char}>
            {c}
          </span>
        ))}
      </span>
    </span>
  );
};

const RollingText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span className={styles.rollingText}>
      {text.split("").map((char, index) => (
        <RollingChar key={index} char={char} index={index} textKey={text} />
      ))}
    </span>
  );
};

const Generator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showLogoDeleteModal, setShowLogoDeleteModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [proffUrl, setProffUrl] = useState("");
  const [service, setService] = useState("Web");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");
  const [editableCompanyName, setEditableCompanyName] = useState("");
  const [editableEmail, setEditableEmail] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [editableAddress, setEditableAddress] = useState("");
  const [editableCity, setEditableCity] = useState("");
  const [editableLinkedIn, setEditableLinkedIn] = useState("");
  const [editableEmailContent, setEditableEmailContent] = useState("");
  const [meetingDate1, setMeetingDate1] = useState("");
  const [meetingDate2, setMeetingDate2] = useState("");
  const [meetingDate3, setMeetingDate3] = useState("");
  const [bookingLinks, setBookingLinks] = useState<string[]>([]);
  const [bookedSlotIndex, setBookedSlotIndex] = useState<number | null>(null);
  const [møtedato, setMøtedato] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isEmailModified, setIsEmailModified] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [automationIndustry, setAutomationIndustry] = useState("Helse");
  const [automationText1, setAutomationText1] = useState("");
  const [automationText2, setAutomationText2] = useState("");
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationProgress, setAutomationProgress] = useState("");
  const [imagesGenerated, setImagesGenerated] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string>("Ikke startet");
  const [emailLocked, setEmailLocked] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showLogoPreview, setShowLogoPreview] = useState(false);
  const [isClosingPreview, setIsClosingPreview] = useState(false);
  const [logoMode, setLogoMode] = useState<"light" | "dark">("light");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId] = useState(
    () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [proffQueue, setProffQueue] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [currentQueueCompany, setCurrentQueueCompany] = useState<any>(null);
  const [queueUpdateKey, setQueueUpdateKey] = useState(0);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchCancelled, setBatchCancelled] = useState(false);
  const [searchUrl, setSearchUrl] = useState("");
  const [editingSearchUrl, setEditingSearchUrl] = useState(false);

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

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Restore current entry from backend on mount
  useEffect(() => {
    const savedEntryId = localStorage.getItem("generator_currentEntryId");
    if (savedEntryId) {
      // Fetch the entry from backend and load it
      fetch(`${API_URL}/api/history`)
        .then((res) => res.json())
        .then((response) => {
          const entries = response.data || response;
          const entry = entries.find((e: any) => e.id === savedEntryId);
          if (entry) {
            handleLoadHistoryEntry(entry);
          }
        })
        .catch((error) => {
          console.error("Failed to restore entry from backend:", error);
        });
    }
  }, []);

  // Save current entry ID to localStorage
  useEffect(() => {
    if (currentEntryId) {
      localStorage.setItem("generator_currentEntryId", currentEntryId);
    }
  }, [currentEntryId]);

  // Warn user before leaving during active generation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading || runningAutomation) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loading, runningAutomation]);

  // Keep editable fields in sync with the latest generation result
  useEffect(() => {
    if (isLoadingHistory) {
      // Skip updates during history loading to prevent race conditions
      return;
    }
    console.log(
      "useEffect triggered - result.emailContent:",
      result?.emailContent?.substring(0, 100)
    );
    console.log("useEffect - company name:", result?.companyName);
    setEditableCompanyName(result?.companyName || "");
    setEditableEmail(result?.email || "");
    setEditablePhone(result?.phone || "");
    setEditableAddress(result?.address || "");
    setEditableCity(result?.city || "");
    setEditableLinkedIn("");
    setEditableEmailContent(result?.emailContent || "");
    setIsEmailModified(false);
    console.log("useEffect - after setEditableEmailContent");
  }, [result, isLoadingHistory]);

  // Poll for updates to the current entry (e.g., booking confirmations)
  useEffect(() => {
    if (!result?.notionPageId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/history`);
        const data = await response.json();

        if (data.success) {
          const currentEntry = data.data.find(
            (entry: any) => entry.notionPageId === result.notionPageId
          );

          if (currentEntry) {
            // Check if meeting date or lead status has changed
            const hasBookingUpdate =
              currentEntry.møtedato && !result.hasOwnProperty("møtedato");
            const hasStatusUpdate =
              currentEntry.leadStatus !== result.leadStatus;

            if (hasBookingUpdate || hasStatusUpdate) {
              console.log(
                "📅 Detected booking or status update, refreshing data..."
              );

              // Update result with new data
              setResult((prev) => ({
                ...prev!,
                leadStatus: currentEntry.leadStatus,
              }));

              setLeadStatus(currentEntry.leadStatus || "Ikke startet");

              // If there's a booking date, you might want to show a notification
              if (hasBookingUpdate) {
                console.log("🎉 Meeting booked:", currentEntry.møtedato);
                // Optionally show a toast/notification to the user
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll for updates:", error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [result?.notionPageId, result?.leadStatus]);

  const handleGetScreenshots = useCallback(async () => {
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
        setError(data.error || "Kunne ikke ta skjermbilder");
      }
    } catch (error) {
      setError("Kunne ikke ta skjermbilder. Prøv igjen.");
    } finally {
      setLoadingScreenshots(false);
    }
  }, [result]);

  // Auto-populate automation fields based on scraped data
  useEffect(() => {
    if (result?.industry && result?.companyName) {
      const industry = result.industry.toLowerCase();

      // Set industry dropdown
      if (industry.includes("helse") || industry.includes("aktivitet")) {
        setAutomationIndustry("Helse");
        setAutomationText1("Helsefirmaet");
      } else if (industry.includes("bygg")) {
        setAutomationIndustry("Bygg");
        setAutomationText1("Entreprenør");
      } else if (industry.includes("advokat") || industry.includes("jus")) {
        setAutomationIndustry("Advokat");
        setAutomationText1("Advokatfirmaet");
      } else {
        // Default to Advokat if industry doesn't match
        setAutomationIndustry("Advokat");
        setAutomationText1("Advokatfirmaet");
      }

      // Set Text 2 to capitalized company name
      const capitalizedName = result.companyName
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
      setAutomationText2(capitalizedName);
    }
  }, [result]);

  const autoSaveLogoMode = useCallback(
    async (mode: "light" | "dark") => {
      if (!result?.sanityPresentationId || !result?.notionPageId) return;

      try {
        await fetch(`${API_URL}/api/update`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageId: result.notionPageId,
            presentationId: result.sanityPresentationId,
            logoMode: mode,
          }),
        });
      } catch (err: any) {
        console.error("Auto-save logo mode error:", err);
      }
    },
    [result?.sanityPresentationId, result?.notionPageId]
  );

  // Fetch Proff queue
  const fetchProffQueue = useCallback(async () => {
    try {
      const response = await fetch(`${LOCAL_API_URL}/api/proff-queue`);
      const data = await response.json();
      if (data.success) {
        console.log(`📥 Fetched queue: ${data.queue.length} companies`);
        setProffQueue(data.queue || []);
        setSearchUrl(data.metadata?.searchUrl || "");
        setQueueUpdateKey((prev) => prev + 1); // Force re-render
        return data.queue || [];
      }
    } catch (error) {
      // Silently fail if backend is not running
      console.log("❌ Failed to fetch queue (backend offline?)");
      setProffQueue([]);
    }
    return [];
  }, []);

  // Refill Proff queue
  const refillProffQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      console.log("🔄 Refilling queue...");
      const response = await fetch(`${LOCAL_API_URL}/api/proff-queue/refill`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        console.log(`✅ Refill complete: added ${data.added} companies`);
        await fetchProffQueue();
      }
    } catch (error) {
      console.error("Failed to refill Proff queue:", error);
      setProffQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, [fetchProffQueue]);

  // Update search URL
  const updateSearchUrl = useCallback(async (newUrl: string) => {
    try {
      const response = await fetch(`${LOCAL_API_URL}/api/proff-queue/search-url`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchUrl: newUrl }),
      });
      const data = await response.json();
      if (data.success) {
        console.log("✅ Search URL updated successfully");
        setSearchUrl(newUrl);
        setEditingSearchUrl(false);
      }
    } catch (error) {
      console.error("Failed to update search URL:", error);
    }
  }, []);

  // Generate from queue item
  const handleGenerateFromQueue = async (company: any) => {
    // Simply update the proffUrl state - the user will then click "Generate" button
    // Or we can trigger generation directly here
    setProffUrl(company.proffUrl);
    setError("");

    // Track which company we're generating
    setCurrentQueueCompany(company);

    // Trigger generation
    if (!company.proffUrl) {
      setError("Ugyldig Proff-lenke");
      return;
    }

    setLoading(true);
    setResult(null);
    setPitchDeckUrl("");
    setEditableEmail("");
    setEditablePhone("");
    setEditableAddress("");
    setEditableCity("");
    setEditableLinkedIn("");
    setLoadingStep("Starter...");

    try {
      const response = await fetch(`${LOCAL_API_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          proffUrl: company.proffUrl,
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
            }

            if (data.complete && data.data) {
              const generatedData = data.data;
              setResult(generatedData);
              setEditableCompanyName(generatedData.companyName);
              setEditableEmail(generatedData.email);
              setEditablePhone(generatedData.phone || "");
              setEditableAddress(generatedData.address || "");
              setEditableCity(generatedData.city || "");
              setEditableLinkedIn(generatedData.contactPersonUrl || "");
              setEditableEmailContent(generatedData.emailContent);
              setCurrentEntryId(generatedData.notionPageId);

              // Set meeting dates and booking links if available
              if (generatedData.meetingDates) {
                setMeetingDate1(generatedData.meetingDates[0] || "");
                setMeetingDate2(generatedData.meetingDates[1] || "");
                setMeetingDate3(generatedData.meetingDates[2] || "");
              }
              if (generatedData.bookingLinks) {
                setBookingLinks(generatedData.bookingLinks);
              }

              if (generatedData.leadStatus) {
                setLeadStatus(generatedData.leadStatus);
              }
            }

            if (data.error) {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Load queue on mount and auto-refill if needed
  useEffect(() => {
    const loadAndRefillQueue = async () => {
      await fetchProffQueue();
      // Check if we need to refill after fetching
      const response = await fetch(`${LOCAL_API_URL}/api/proff-queue`);
      const data = await response.json();
      if (data.success && data.queue.length < 10) {
        console.log(
          `📊 Queue has only ${data.queue.length} items, auto-refilling...`
        );
        await refillProffQueue();
      }
    };
    loadAndRefillQueue();
  }, []);

  // Auto-refill queue when it gets low
  useEffect(() => {
    if (
      proffQueue.length > 0 &&
      proffQueue.length < 10 &&
      !loadingQueue &&
      !batchGenerating
    ) {
      console.log(
        `📊 Queue low (${proffQueue.length} items), auto-refilling...`
      );
      refillProffQueue();
    }
  }, [proffQueue.length, loadingQueue, batchGenerating]);

  // Remove company from queue after generation/loading completes
  useEffect(() => {
    if (currentQueueCompany && result?.notionPageId) {
      console.log(
        "🎯 Removing company from queue after generation/load:",
        currentQueueCompany.companyName
      );

      // Clear the current company reference immediately
      const companyToRemove = currentQueueCompany;
      setCurrentQueueCompany(null);

      // Handle backend operations and UI update
      (async () => {
        try {
          // Delete from backend
          console.log(`🗑️ Deleting ${companyToRemove.id} from backend...`);
          await fetch(
            `${LOCAL_API_URL}/api/proff-queue/${companyToRemove.id}`,
            {
              method: "DELETE",
            }
          );
          console.log(
            `✅ Removed ${companyToRemove.companyName} from backend queue`
          );

          // Refill to get next company
          console.log("🔄 Refilling queue...");
          await refillProffQueue();

          // Force immediate UI refresh by fetching the entire queue again
          console.log("🔄 Fetching updated queue...");
          await fetchProffQueue();

          // Force re-render
          setQueueUpdateKey((prev) => prev + 1);

          console.log("✨ Queue update complete!");
        } catch (error) {
          console.error("Failed to remove/refill queue:", error);
        }
      })();
    }
  }, [
    currentQueueCompany,
    result?.notionPageId,
    refillProffQueue,
    fetchProffQueue,
  ]);

  // Batch generate all companies in queue
  const handleGenerateAll = async () => {
    if (proffQueue.length === 0) {
      setError("Ingen bedrifter i køen");
      return;
    }

    setBatchGenerating(true);
    setBatchCancelled(false);
    const companies = [...proffQueue]; // Copy the queue
    setBatchProgress({ current: 0, total: companies.length });

    console.log(
      `🚀 Starting batch generation for ${companies.length} companies`
    );

    for (let i = 0; i < companies.length; i++) {
      // Check if cancelled
      if (batchCancelled) {
        console.log("❌ Batch generation cancelled");
        break;
      }

      const company = companies[i];
      setBatchProgress({ current: i + 1, total: companies.length });
      console.log(
        `📧 Generating ${i + 1}/${companies.length}: ${company.companyName}`
      );

      try {
        // Call the generation function (reuse handleGenerateFromQueue logic)
        await handleGenerateFromQueue(company);

        // Wait for generation to complete (watch for result to be set)
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            // Simple wait - in practice the generation will set result
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 1000);
          }, 500);
        });

        console.log(
          `✅ Completed ${i + 1}/${companies.length}: ${company.companyName}`
        );

        // Small delay between generations to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `❌ Failed to generate for ${company.companyName}:`,
          error
        );
        // Continue with next company even if this one fails
      }
    }

    setBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0 });
    console.log("🎉 Batch generation complete!");

    // Refresh the queue
    await fetchProffQueue();
  };

  // Cancel batch generation
  const handleCancelBatch = () => {
    setBatchCancelled(true);
    setBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0 });
  };

  const handleGenerate = async () => {
    if (!proffUrl) {
      setError("Lim inn en Proff.no-lenke");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setPitchDeckUrl("");
    setEditableEmail("");
    setEditablePhone("");
    setEditableAddress("");
    setEditableCity("");
    setEditableLinkedIn("");
    setLoadingStep("Starter...");

    try {
      const response = await fetch(`${LOCAL_API_URL}/api/generate`, {
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
              console.log("✅ Generation response data:", data.data);
              console.log("✅ Meeting dates:", data.data.meetingDates);
              console.log("✅ Booking links:", data.data.bookingLinks);
              setResult(data.data);
              // Track entry ID for localStorage
              if (data.data.notionPageId) {
                setCurrentEntryId(data.data.notionPageId);
              }
              // Automatically set pitch deck URL if available
              if (data.data.presentationUrl) {
                setPitchDeckUrl(data.data.presentationUrl);
              }
              // Load meeting dates and booking links
              if (data.data.meetingDates) {
                setMeetingDate1(data.data.meetingDates[0] || "");
                setMeetingDate2(data.data.meetingDates[1] || "");
                setMeetingDate3(data.data.meetingDates[2] || "");
                console.log(
                  "✅ Set meeting dates:",
                  data.data.meetingDates[0],
                  data.data.meetingDates[1],
                  data.data.meetingDates[2]
                );
              }
              if (data.data.bookingLinks) {
                setBookingLinks(data.data.bookingLinks);
                console.log("✅ Set booking links:", data.data.bookingLinks);
              }
            } else if (data.error) {
              setError(data.error);
            }
          }
        }
      }
    } catch (error) {
      setError("Nettverksfeil. Prøv igjen.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleRunAutomation = async () => {
    if (!result?.companyName) {
      setError("No company information available.");
      return;
    }

    if (!automationText1 || !automationText2) {
      setError("Please fill in both text fields.");
      return;
    }

    setRunningAutomation(true);
    setAutomationProgress("Starting automation...");
    setError("");

    // Connect to SSE for progress updates
    const eventSource = new EventSource(
      `${LOCAL_API_URL}/api/progress/stream?clientId=${clientId}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message) {
        setAutomationProgress(data.message);

        // Set imagesGenerated flag when upload completes
        if (
          data.message.includes("All generated files uploaded successfully")
        ) {
          console.log("✅ Setting imagesGenerated to true");
          setImagesGenerated(true);

          // Save imagesGenerated flag to backend (both local and production)
          if (result?.notionPageId) {
            const updatePayload = {
              pageId: result.notionPageId,
              imagesGenerated: true,
            };

            // Update local backend
            fetch(`${LOCAL_API_URL}/api/update`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(updatePayload),
            })
              .then(() => {
                console.log("✅ Saved imagesGenerated flag to local backend");
              })
              .catch((error) => {
                console.error("Failed to save imagesGenerated flag to local backend:", error);
              });

            // Update production backend
            fetch(`${API_URL}/api/update`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(updatePayload),
            })
              .then(() => {
                console.log("✅ Saved imagesGenerated flag to production backend");
              })
              .catch((error) => {
                console.error("Failed to save imagesGenerated flag:", error);
              });
          }
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const response = await fetch(`${LOCAL_API_URL}/api/automation/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          industry: automationIndustry,
          text1: automationText1,
          text2: automationText2,
          address: editableAddress || result.address || "",
          city: editableCity || result.city || "",
          clientId: clientId,
        }),
      });

      const data = await response.json();
      console.log("📊 Automation completed:", data);

      if (data.success) {
        console.log("✅ Automation successful, triggering file upload...");
        // Trigger file upload after automation completes
        await handleUploadGeneratedFiles(data.finalsPath, data.rendersPath);
      } else {
        console.error("❌ Automation failed:", data.error);
        setError(data.error || "Failed to run automation");
        setRunningAutomation(false);
        setAutomationProgress("");
      }

      eventSource.close();
    } catch (error) {
      console.error("❌ Automation request error:", error);
      setError("Failed to run automation. Please try again.");
      setRunningAutomation(false);
      setAutomationProgress("");
      eventSource.close();
    }
  };

  const handleUploadGeneratedFiles = async (
    finalsPath: string,
    rendersPath: string
  ) => {
    if (!result?.sanityPresentationId) {
      console.error("❌ No Sanity presentation ID found, cannot upload files");
      setRunningAutomation(false);
      setAutomationProgress("");
      return;
    }

    console.log("📤 Starting file upload to Sanity...");
    console.log("  Presentation ID:", result.sanityPresentationId);
    console.log("  Industry:", automationIndustry);
    console.log("  Finals path:", finalsPath);
    console.log("  Renders path:", rendersPath);

    try {
      const response = await fetch(
        `${LOCAL_API_URL}/api/files/upload-generated`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            presentationId: result.sanityPresentationId,
            industry: automationIndustry,
            finalsPath: finalsPath,
            rendersPath: rendersPath,
            clientId: clientId,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("✅ File upload successful:", data);
        setUploadSuccess(true);
        setAutomationProgress("");
        console.log("Uploaded files:", data.uploadedFiles);
      } else {
        console.error("❌ File upload failed:", data.error);
        setError(data.error || "Failed to upload generated files");
        setAutomationProgress("");
      }
    } catch (error) {
      console.error("❌ File upload error:", error);
      setError("Failed to upload generated files. Please try again.");
      setAutomationProgress("");
    } finally {
      setRunningAutomation(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!result?.notionPageId) return;

    setSavingEmail(true);
    try {
      const response = await fetch(`${API_URL}/api/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: result.notionPageId,
          emailContent: editableEmailContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save email");
      }

      // Update result state with new email content
      setResult((prev) =>
        prev ? { ...prev, emailContent: editableEmailContent } : prev
      );

      setIsEmailModified(false);
      setEmailSaved(true);

      // Hide success message after 2 seconds
      setTimeout(() => {
        setEmailSaved(false);
      }, 2000);
    } catch (err: any) {
      console.error("Save email error:", err);
      setAlertTitle("Feil ved lagring");
      setAlertMessage(`Failed to save email: ${err.message}`);
      setShowAlertModal(true);
    } finally {
      setSavingEmail(false);
    }
  };

  // Debounced auto-save for contact fields
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const autoSaveContactField = useCallback(
    (fieldName: string, value: string) => {
      if (!result?.notionPageId) return;

      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set new timeout to update after 500ms of no typing
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`${API_URL}/api/update`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              [fieldName]: value,
            }),
          });
        } catch (err: any) {
          console.error(`Auto-save ${fieldName} error:`, err);
        }
      }, 500);
    },
    [result?.notionPageId]
  );

  // Auto-save meeting dates to history
  const autoSaveMeetingDates = useCallback(
    (dates: [string, string, string]) => {
      if (!result?.notionPageId) return;

      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set new timeout to update after 500ms
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`${API_URL}/api/update`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              meetingDates: dates,
            }),
          });
          console.log("✅ Meeting dates saved to history:", dates);
        } catch (err: any) {
          console.error("Auto-save meeting dates error:", err);
        }
      }, 500);
    },
    [result?.notionPageId]
  );

  const autoSaveCompanyName = useCallback(
    (value: string) => {
      if (!result?.notionPageId || !result?.sanityPresentationId) return;

      const oldCompanyName = result.companyName;
      const sanityUniqueId = result.sanityUniqueId;

      // 1. UPDATE FRONTEND IMMEDIATELY

      // Generate new presentation URL immediately
      const slugifiedName = value
        .toLowerCase()
        .replace(/[^a-z0-9æøå]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const newPresentationUrl = sanityUniqueId
        ? `https://www.no-offence.io/presentation/${slugifiedName}/${sanityUniqueId}`
        : null;

      // Update pitch deck URL immediately
      if (newPresentationUrl) {
        setPitchDeckUrl(newPresentationUrl);
      }

      // Update email content with new company name immediately
      if (oldCompanyName && value) {
        setEditableEmailContent((prev) => {
          let updated = prev;

          // Replace company name
          if (prev.includes(oldCompanyName)) {
            updated = updated.replace(new RegExp(oldCompanyName, "g"), value);
          }

          // Replace presentation URL
          if (newPresentationUrl) {
            const urlPattern =
              /https:\/\/www\.no-offence\.io\/presentation\/[^/]+\/[\w-]+/g;
            const newUrlUniqueId = newPresentationUrl.split("/").pop();

            updated = updated.replace(urlPattern, (match) => {
              const matchUniqueId = match.split("/").pop();
              if (matchUniqueId === newUrlUniqueId) {
                return newPresentationUrl;
              }
              return match;
            });
          }

          return updated;
        });
      }

      // Update Text 2 in automation section immediately
      const capitalizedName = value
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
      setAutomationText2(capitalizedName);

      // 2. THEN UPDATE BACKEND AFTER DEBOUNCE

      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set new timeout to update backend after 500ms of no typing
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("💾 Saving to backend:", value);

          // Update in Notion and Sanity
          const response = await fetch(`${API_URL}/api/update`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              companyName: value,
              sanityPresentationId: result.sanityPresentationId,
              sanityUniqueId: result.sanityUniqueId,
            }),
          });

          const data = await response.json();
          console.log("✅ Backend update complete:", data);
        } catch (err: any) {
          console.error("❌ Auto-save company name error:", err);
        }
      }, 500);
    },
    [
      result?.notionPageId,
      result?.sanityPresentationId,
      result?.companyName,
      result?.sanityUniqueId,
    ]
  );

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !result?.sanityPresentationId) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      setAlertTitle("Ugyldig filtype");
      setAlertMessage("Vennligst velg en bildefil");
      setShowAlertModal(true);
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAlertTitle("Fil for stor");
      setAlertMessage("Filstørrelsen må være mindre enn 5MB");
      setShowAlertModal(true);
      return;
    }

    setUploadingLogo(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];

        try {
          const response = await fetch(`${API_URL}/api/upload/logo`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              presentationId: result.sanityPresentationId,
              imageData: base64Data,
              fileType: file.type,
              fileName: file.name,
            }),
          });

          const data = await response.json();

          if (data.success) {
            // Update result with new logo URL
            setResult((prev) =>
              prev ? { ...prev, logoUrl: data.logoUrl } : prev
            );
            setAlertTitle("Suksess");
            setAlertMessage("Logo lastet opp!");
            setShowAlertModal(true);
          } else {
            throw new Error(data.error || "Failed to upload logo");
          }
        } catch (err: any) {
          console.error("Logo upload error:", err);
          setAlertTitle("Feil ved opplasting");
          setAlertMessage(`Failed to upload logo: ${err.message}`);
          setShowAlertModal(true);
        } finally {
          setUploadingLogo(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("File read error:", err);
      setAlertTitle("Feil ved lesing av fil");
      setAlertMessage(`Failed to read file: ${err.message}`);
      setShowAlertModal(true);
      setUploadingLogo(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClosePreview = () => {
    setIsClosingPreview(true);
    setTimeout(() => {
      setShowLogoPreview(false);
      setIsClosingPreview(false);
    }, 200);
  };

  const handleLogoDelete = async () => {
    if (!result?.sanityPresentationId) return;

    setShowLogoDeleteModal(true);
  };

  const confirmLogoDelete = async () => {
    setShowLogoDeleteModal(false);
    setUploadingLogo(true);

    try {
      const response = await fetch(`${API_URL}/api/upload/logo`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          presentationId: result.sanityPresentationId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update result to remove logo URL
        setResult((prev) => (prev ? { ...prev, logoUrl: undefined } : prev));
        setAlertTitle("Suksess");
        setAlertMessage("Logo slettet!");
        setShowAlertModal(true);
      } else {
        throw new Error(data.error || "Failed to delete logo");
      }
    } catch (err: any) {
      console.error("Logo delete error:", err);
      setAlertTitle("Feil ved sletting");
      setAlertMessage(`Failed to delete logo: ${err.message}`);
      setShowAlertModal(true);
    } finally {
      setUploadingLogo(false);
    }
  };

  const servicePhrase: Record<string, string> = {
    Video: "nye videoer",
    Images: "nye bilder",
    Web: "nye nettsider",
    Branding: "ny branding",
  };

  // Refresh current entry from backend
  const handleRefreshEntry = useCallback(async () => {
    if (!result?.notionPageId) return;

    try {
      const response = await fetch(`${API_URL}/api/history`);
      const data = await response.json();

      if (data.success) {
        const currentEntry = data.data.find(
          (entry: any) => entry.notionPageId === result.notionPageId
        );

        if (currentEntry) {
          console.log("🔄 Refreshing entry from backend...");
          handleLoadHistoryEntry(currentEntry);
        }
      }
    } catch (error) {
      console.error("Failed to refresh entry:", error);
    }
  }, [result?.notionPageId]);

  const handleLoadHistoryEntry = useCallback((entry: any) => {
    console.log("Loading history entry:", entry.companyName);
    console.log(
      "Email content from history:",
      entry.emailContent?.substring(0, 100)
    );

    // Set loading flag to prevent useEffect from interfering
    setIsLoadingHistory(true);

    // Load the history entry into the generator state
    const loadedResult: GenerateResult = {
      companyName: entry.companyName,
      contactPerson: entry.contactPerson,
      contactPersonUrl: entry.contactPersonUrl,
      email: entry.email,
      phone: entry.phone,
      website: entry.website,
      address: entry.address,
      city: entry.city,
      emailContent: entry.emailContent || "",
      notionPageId: entry.notionPageId,
      industry: entry.industry,
      desktopScreenshot: entry.desktopScreenshot,
      mobileScreenshot: entry.mobileScreenshot,
      sanityPresentationId: entry.sanityPresentationId,
      sanityUniqueId: entry.sanityUniqueId,
      presentationUrl: entry.presentationUrl,
      hasScreenshots: entry.hasScreenshots,
      logoUrl: entry.logoUrl,
      leadStatus: entry.leadStatus,
    };

    console.log(
      "loadedResult.emailContent:",
      loadedResult.emailContent?.substring(0, 100)
    );

    // Directly set editable fields
    setEditableCompanyName(loadedResult.companyName);
    setEditableEmail(loadedResult.email || "");
    setEditablePhone(loadedResult.phone || "");
    setEditableAddress(loadedResult.address || "");
    setEditableCity(loadedResult.city || "");
    setEditableLinkedIn("");
    setEditableEmailContent(loadedResult.emailContent);
    setIsEmailModified(false);

    // Load meeting dates if available
    if (entry.meetingDates && entry.meetingDates.length >= 3) {
      setMeetingDate1(entry.meetingDates[0] || "");
      setMeetingDate2(entry.meetingDates[1] || "");
      setMeetingDate3(entry.meetingDates[2] || "");
    } else {
      setMeetingDate1("");
      setMeetingDate2("");
      setMeetingDate3("");
    }

    // Set bookedSlotIndex if available
    setBookedSlotIndex(entry.bookedSlotIndex ?? null);

    // Set møtedato if available
    console.log("📅 Loading entry møtedato:", entry.møtedato);
    setMøtedato(entry.møtedato || null);

    // Set emailLocked if available
    setEmailLocked(entry.emailLocked || false);

    // Track current entry ID for localStorage
    setCurrentEntryId(entry.id);

    // Load booking links if available
    if (entry.bookingLinks) {
      setBookingLinks(entry.bookingLinks);
    } else {
      setBookingLinks([]);
    }

    setResult(loadedResult);

    // Clear loading flag after a brief delay to allow state to settle
    setTimeout(() => setIsLoadingHistory(false), 100);
    setPitchDeckUrl(entry.presentationUrl || "");
    setService(entry.service || "Web");

    // Set automation fields from saved data or calculate from industry
    if (entry.automationIndustry) {
      setAutomationIndustry(entry.automationIndustry);
    } else if (entry.industry) {
      // Fallback: calculate from industry if not saved
      const industry = entry.industry.toLowerCase();
      if (industry.includes("helse") || industry.includes("aktivitet")) {
        setAutomationIndustry("Helse");
      } else if (industry.includes("bygg")) {
        setAutomationIndustry("Bygg");
      } else if (industry.includes("advokat") || industry.includes("jus")) {
        setAutomationIndustry("Advokat");
      } else {
        setAutomationIndustry("Advokat");
      }
    }

    if (entry.automationText1) {
      setAutomationText1(entry.automationText1);
    } else if (entry.industry) {
      // Fallback: calculate from industry
      const industry = entry.industry.toLowerCase();
      if (industry.includes("helse") || industry.includes("aktivitet")) {
        setAutomationText1("Helsefirmaet");
      } else if (industry.includes("bygg")) {
        setAutomationText1("Entreprenør");
      } else {
        setAutomationText1("Advokatfirmaet");
      }
    }

    if (entry.automationText2) {
      setAutomationText2(entry.automationText2);
    } else {
      // Fallback: capitalized company name
      const capitalizedName = entry.companyName
        .split(" ")
        .map(
          (word: string) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
      setAutomationText2(capitalizedName);
    }

    // Set imagesGenerated flag
    setImagesGenerated(entry.imagesGenerated || false);

    // Set emailSent flag
    setEmailSent(entry.emailSent || false);

    // Set leadStatus
    setLeadStatus(entry.leadStatus || "Ikke startet");
  }, []);

  const gmailComposeUrl = (() => {
    if (!result) return "";

    const subject = encodeURIComponent(
      `No Offence, men hva med ${servicePhrase[service] || service}?`
    );
    const body = encodeURIComponent(editableEmailContent);
    const to = encodeURIComponent(editableEmail || result.email || "");

    return `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${to}&su=${subject}&body=${body}`;
  })();

  const mailtoUrl = (() => {
    if (!result) return "";

    const subject = encodeURIComponent(
      `No Offence, men hva med ${servicePhrase[service] || service}?`
    );
    // For mailto, manually replace newlines with %0D%0A after encoding
    const body = encodeURIComponent(editableEmailContent).replace(
      /%0A/g,
      "%0D%0A"
    );
    const to = encodeURIComponent(editableEmail || result.email || "");

    return `mailto:${to}?subject=${subject}&body=${body}`;
  })();

  // Calculate hours remaining until target time
  const hoursRemaining = (() => {
    const now = currentTime;
    const targetTime = new Date(now);
    targetTime.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    // If it's already past target time, show 0
    if (now.getTime() >= targetTime.getTime()) {
      return 0;
    }

    const msRemaining = targetTime.getTime() - now.getTime();
    const hoursLeft = Math.ceil(msRemaining / (1000 * 60 * 60));
    return hoursLeft;
  })();

  // const countdownText =
  //   hoursRemaining === 0
  //     ? "du jobber overtid"
  //     : `det er ${hoursRemaining} timer igjen`;

  // Calculate time until December 2026
  const decemberCountdown = (() => {
    const now = currentTime;
    const targetDate = new Date(2026, 11, 31, 23, 59, 59); // December 31, 2026

    const msRemaining = targetDate.getTime() - now.getTime();
    if (msRemaining <= 0) return "tiden er ute. Begynn å søke jobber.";

    // Calculate months and days
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const monthsRemaining = Math.floor(daysRemaining / 30);
    const remainingDays = daysRemaining % 30;

    if (monthsRemaining === 0) {
      return `${daysRemaining} dager til å stå på egne ben`;
    } else {
      return `${monthsRemaining} måneder til å stå på egne ben`;
    }
  })();

  // Compute dynamic page title
  const pageTitle = (() => {
    // Email generation in progress
    if (loading && loadingStep) {
      // Extract percentage from loading step if present
      const percentMatch = loadingStep.match(/(\d+)%/);
      if (percentMatch) {
        const percent = parseInt(percentMatch[1]);
        const emoji = percent < 30 ? "🔴" : percent < 70 ? "🟠" : "🟢";
        return `${emoji} Salesmode - ${percentMatch[1]}%`;
      }
      // Otherwise show the loading step with orange emoji
      return `🟠 Salesmode - ${loadingStep}`;
    }

    // Mockup/automation generation in progress
    if (runningAutomation && automationProgress) {
      const percentMatch = automationProgress.match(/(\d+)%/);
      if (percentMatch) {
        const percent = parseInt(percentMatch[1]);
        const emoji = percent < 30 ? "🔴" : percent < 70 ? "🟠" : "🟢";
        return `${emoji} Salesmode - ${percentMatch[1]}%`;
      }
      return `🟠 Salesmode - ${automationProgress}`;
    }

    if (result?.companyName || editableCompanyName) {
      return `Salesmode - ${editableCompanyName || result?.companyName}`;
    }

    return "Salesmode";
  })();

  if (checkingSetup) {
    return (
      <div className={styles.generator}>
        <Helmet>
          <title>{pageTitle}</title>
        </Helmet>
        <div className={styles.container}>
          <p>Sjekker oppsett...</p>
        </div>
      </div>
    );
  }

  if (deleting) {
    return (
      <div className={styles.generator}>
        <Helmet>
          <title>{pageTitle}</title>
        </Helmet>
        <div className={styles.deletingOverlay}>
          <div className={styles.spinner}></div>
          <p>Sletter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.generator}>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      <div className={styles.container}>
        <h1
          className={styles.title}
          onClick={() => {
            setResult(null);
            setError("");
            setProffUrl("");
            setCurrentEntryId(null);
            setCurrentQueueCompany(null);
          }}
          style={{ cursor: "pointer" }}
        >
          No Offence
        </h1>

        <p
          className={styles.subtitle}
          style={{
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          <RollingClock time={currentTime} />
          <br />
          {/* <span
            style={{
              fontSize: "0.65rem",
              fontWeight: "normal",
              opacity: 0.7,
              marginTop: "8px",
              display: "inline-block",
            }}
          >
            <RollingText text={countdownText} />
          </span> */}

          {/* <span
            style={{
              fontSize: "0.55rem",
              fontWeight: "normal",
              opacity: 0.9,
              marginTop: "4px",
              display: "inline-block",
              textTransform: "none",
              letterSpacing: "auto",
            }}
          >
            ({decemberCountdown})
          </span> */}
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
            data-generate-button
          >
            Generer e-post
          </Button>

          {/* Proff Queue Section - Hidden when viewing a result */}
          {!result && (
            <div className={styles.proffQueue}>
              <div className={styles.queueHeader}>
                <h3>Kø fra Proff.no</h3>
                <div className={styles.queueActions}>
                  <button
                    onClick={refillProffQueue}
                    disabled={loadingQueue || batchGenerating}
                    className={styles.refillButton}
                  >
                    {loadingQueue ? "Laster..." : "Last inn bedrifter"}
                  </button>
                  {proffQueue.length > 0 && !batchGenerating && (
                    <button
                      onClick={handleGenerateAll}
                      disabled={loading || loadingQueue}
                      className={styles.generateAllButton}
                    >
                      Generer alle ({proffQueue.length})
                    </button>
                  )}
                  {batchGenerating && (
                    <button
                      onClick={handleCancelBatch}
                      className={styles.cancelBatchButton}
                    >
                      Avbryt ({batchProgress.current}/{batchProgress.total})
                    </button>
                  )}
                </div>
              </div>

              {/* Source URL Section */}
              <div className={styles.sourceUrlSection}>
                <label className={styles.sourceUrlLabel}>Kilde-URL:</label>
                {editingSearchUrl ? (
                  <div className={styles.sourceUrlEdit}>
                    <input
                      type="text"
                      value={searchUrl}
                      onChange={(e) => setSearchUrl(e.target.value)}
                      className={styles.sourceUrlInput}
                      placeholder="Proff.no søke-URL"
                    />
                    <button
                      onClick={() => updateSearchUrl(searchUrl)}
                      className={styles.saveButton}
                    >
                      Lagre
                    </button>
                    <button
                      onClick={() => {
                        setEditingSearchUrl(false);
                        fetchProffQueue(); // Reset to saved value
                      }}
                      className={styles.cancelButton}
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <div className={styles.sourceUrlDisplay}>
                    <span className={styles.sourceUrlText}>{searchUrl || "Ingen URL satt"}</span>
                    <button
                      onClick={() => setEditingSearchUrl(true)}
                      className={styles.editButton}
                    >
                      Rediger
                    </button>
                  </div>
                )}
              </div>

              {batchGenerating && (
                <div className={styles.batchProgress}>
                  Genererer {batchProgress.current} av {batchProgress.total}...
                </div>
              )}
              {proffQueue.length > 0 ? (
                <div className={styles.queueList}>
                  {proffQueue.slice(0, 10).map((company, index) => (
                    <button
                      key={`${company.id}-${queueUpdateKey}-${index}`}
                      onClick={() => handleGenerateFromQueue(company)}
                      disabled={loading || loadingQueue || batchGenerating}
                      className={styles.queueButton}
                    >
                      Generer {company.companyName}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.queueEmpty}>
                  Klikk "Last inn bedrifter" for å hente fra Proff.no
                </div>
              )}
            </div>
          )}
        </div>

        {result && (
          <div className={styles.result}>
            <h2 className={styles.resultTitle}>Generated Email</h2>

            <div className={styles.info}>
              <div className={styles.companyRow}>
                <div className={styles.companyInfo}>
                  <div className={styles.infoItem}>
                    <strong>Company:</strong>{" "}
                    <input
                      type="text"
                      className={styles.inlineEditable}
                      value={editableCompanyName}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableCompanyName(newValue);
                        autoSaveCompanyName(newValue);
                      }}
                      disabled={loading}
                    />
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
                  <div className={styles.infoItem}>
                    <strong>Email:</strong>{" "}
                    <input
                      type="email"
                      className={styles.inlineEditable}
                      value={editableEmail}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableEmail(newValue);
                        autoSaveContactField("email", newValue);
                      }}
                      disabled={loading}
                      placeholder="Enter email address"
                    />
                  </div>
                  {result.phone && (
                    <div className={styles.infoItem}>
                      <strong>Phone:</strong>{" "}
                      <input
                        type="tel"
                        className={styles.inlineEditable}
                        value={editablePhone}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setEditablePhone(newValue);
                          autoSaveContactField("phone", newValue);
                        }}
                        disabled={loading}
                      />
                    </div>
                  )}
                  {(result.address || editableAddress) && (
                    <div className={styles.infoItem}>
                      <strong>Address:</strong>{" "}
                      <input
                        type="text"
                        className={styles.inlineEditable}
                        value={editableAddress}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setEditableAddress(newValue);
                          autoSaveContactField("address", newValue);
                        }}
                        disabled={loading}
                      />
                    </div>
                  )}
                  {(result.city || editableCity) && (
                    <div className={styles.infoItem}>
                      <strong>City:</strong>{" "}
                      <input
                        type="text"
                        className={styles.inlineEditable}
                        value={editableCity}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setEditableCity(newValue);
                          autoSaveContactField("city", newValue);
                        }}
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <strong>LinkedIn:</strong>{" "}
                    <input
                      type="url"
                      className={styles.inlineEditable}
                      placeholder="Enter LinkedIn profile URL"
                      value={editableLinkedIn}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableLinkedIn(newValue);
                        autoSaveContactField("linkedIn", newValue);
                      }}
                      disabled={loading}
                    />
                  </div>

                  {/* Meeting Date Pickers */}

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
                  {(meetingDate1 || meetingDate2 || meetingDate3) && (
                    <div className={styles.meetingDatesSection}>
                      {møtedato ? (
                        // Show single confirmed meeting date from Notion
                        <>
                          <strong
                            style={{
                              marginBottom: "12px",
                              display: "block",
                              fontSize: "14px",
                            }}
                          >
                            Confirmed Meeting:
                          </strong>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "16px 20px",
                              backgroundColor: "#1a1a1a",
                              borderRadius: "24px",
                              border: "1px solid #333",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                color: "#ffffff",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {(() => {
                                const d = new Date(møtedato);
                                if (isNaN(d.getTime())) return "";
                                const offset = d.getTimezoneOffset() * 60000;
                                const localDate = new Date(
                                  d.getTime() - offset
                                );
                                const formatted = localDate
                                  .toISOString()
                                  .slice(0, 16)
                                  .replace("T", ", ");
                                return formatted;
                              })()}
                            </span>
                            <span
                              style={{
                                marginLeft: "auto",
                                padding: "4px 12px",
                                backgroundColor: "#4CAF50",
                                color: "#ffffff",
                                borderRadius: "12px",
                                fontSize: "13px",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              ✓ Booked
                            </span>
                          </div>
                        </>
                      ) : (
                        // Show 3 meeting proposals
                        <>
                          <strong>Meeting Proposals:</strong>
                          <div className={styles.meetingDates}>
                            <div className={styles.datePickerItem}>
                              <label>Slot 1:</label>
                              <input
                                type="datetime-local"
                                className={styles.inlineEditable}
                                value={
                                  meetingDate1
                                    ? (() => {
                                        const d = new Date(meetingDate1);
                                        if (isNaN(d.getTime())) return "";
                                        const offset =
                                          d.getTimezoneOffset() * 60000;
                                        const localDate = new Date(
                                          d.getTime() - offset
                                        );
                                        return localDate
                                          .toISOString()
                                          .slice(0, 16);
                                      })()
                                    : ""
                                }
                                onChange={(e) => {
                                  const newDate = e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : "";
                                  setMeetingDate1(newDate);
                                  autoSaveMeetingDates([
                                    newDate,
                                    meetingDate2,
                                    meetingDate3,
                                  ]);
                                }}
                                disabled={loading}
                              />
                              {bookingLinks[0] && (
                                <a
                                  href={bookingLinks[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.bookingLink}
                                >
                                  🔗
                                </a>
                              )}
                            </div>
                            <div className={styles.datePickerItem}>
                              <label>Slot 2:</label>
                              <input
                                type="datetime-local"
                                className={styles.inlineEditable}
                                value={
                                  meetingDate2
                                    ? (() => {
                                        const d = new Date(meetingDate2);
                                        if (isNaN(d.getTime())) return "";
                                        const offset =
                                          d.getTimezoneOffset() * 60000;
                                        const localDate = new Date(
                                          d.getTime() - offset
                                        );
                                        return localDate
                                          .toISOString()
                                          .slice(0, 16);
                                      })()
                                    : ""
                                }
                                onChange={(e) => {
                                  const newDate = e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : "";
                                  setMeetingDate2(newDate);
                                  autoSaveMeetingDates([
                                    meetingDate1,
                                    newDate,
                                    meetingDate3,
                                  ]);
                                }}
                                disabled={loading}
                              />
                              {bookingLinks[1] && (
                                <a
                                  href={bookingLinks[1]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.bookingLink}
                                >
                                  🔗
                                </a>
                              )}
                            </div>
                            <div className={styles.datePickerItem}>
                              <label>Slot 3:</label>
                              <input
                                type="datetime-local"
                                className={styles.inlineEditable}
                                value={
                                  meetingDate3
                                    ? (() => {
                                        const d = new Date(meetingDate3);
                                        if (isNaN(d.getTime())) return "";
                                        const offset =
                                          d.getTimezoneOffset() * 60000;
                                        const localDate = new Date(
                                          d.getTime() - offset
                                        );
                                        return localDate
                                          .toISOString()
                                          .slice(0, 16);
                                      })()
                                    : ""
                                }
                                onChange={(e) => {
                                  const newDate = e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : "";
                                  setMeetingDate3(newDate);
                                  autoSaveMeetingDates([
                                    meetingDate1,
                                    meetingDate2,
                                    newDate,
                                  ]);
                                }}
                                disabled={loading}
                              />
                              {bookingLinks[2] && (
                                <a
                                  href={bookingLinks[2]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.bookingLink}
                                >
                                  🔗
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.logoColumn}>
                  <div className={styles.logoSection}>
                    {result.logoUrl && (
                      <>
                        <div className={styles.logoPreviews}>
                          <div
                            className={`${styles.logoPreviewBox} ${
                              logoMode === "light" ? styles.selected : ""
                            }`}
                            style={{
                              background:
                                "linear-gradient(180deg, #e3deea 0%, #edd1d1 100%)",
                            }}
                            onClick={() => {
                              setLogoMode("light");
                              autoSaveLogoMode("light");
                            }}
                          >
                            <img
                              src={result.logoUrl}
                              alt={`${editableCompanyName} logo`}
                              className={styles.logo}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                          <div
                            className={`${styles.logoPreviewBox} ${
                              logoMode === "dark" ? styles.selected : ""
                            }`}
                            style={{
                              background: "#0f0f0f",
                              border: "1px solid rgba(255, 255, 255, 0.002)",
                            }}
                            onClick={() => {
                              setLogoMode("dark");
                              autoSaveLogoMode("dark");
                            }}
                          >
                            <img
                              src={result.logoUrl}
                              alt={`${editableCompanyName} logo`}
                              className={styles.logo}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className={styles.logoButtons}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: "none" }}
                      />
                      {result.logoUrl && (
                        <button
                          className={styles.logoActionBtn}
                          onClick={handleLogoDelete}
                          disabled={uploadingLogo}
                        >
                          <img
                            src={trashIcon}
                            alt="Delete"
                            className={styles.trashIcon}
                          />
                          Delete
                        </button>
                      )}
                      <button
                        className={styles.uploadLogoBtn}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        {uploadingLogo
                          ? "Uploading..."
                          : result.logoUrl
                          ? "Replace Logo"
                          : "Upload Logo"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {showLogoPreview && result.logoUrl && (
                <div
                  className={`${styles.logoModal} ${
                    isClosingPreview ? styles.closing : ""
                  } ${
                    logoMode === "dark" ? styles.darkMode : styles.lightMode
                  }`}
                  onClick={handleClosePreview}
                >
                  <div className={styles.logoModalContent}>
                    <img
                      src={result.logoUrl}
                      alt={`${editableCompanyName} logo`}
                      className={`${styles.logoModalImage} ${
                        isClosingPreview ? styles.closingImage : ""
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <textarea
              className={styles.textarea}
              value={editableEmailContent}
              onChange={(e) => {
                setEditableEmailContent(e.target.value);
                setIsEmailModified(true);
              }}
              rows={15}
              disabled={emailLocked || emailSent}
            />

            {!emailLocked && (
              <div className={styles.emailSentCheckbox}>
                <label>
                  <input
                    type="checkbox"
                    checked={emailSent}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setEmailSent(newValue);

                      // Update leadStatus when email is sent
                      const newLeadStatus = newValue
                        ? "Tilbud sendt"
                        : "Ikke startet";
                      setLeadStatus(newLeadStatus);

                      // Save to backend
                      if (result?.notionPageId) {
                        try {
                          await fetch(`${API_URL}/api/update`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              pageId: result.notionPageId,
                              emailSent: newValue,
                              leadStatus: newLeadStatus,
                            }),
                          });
                        } catch (error) {
                          console.error(
                            "Failed to save emailSent flag:",
                            error
                          );
                        }
                      }
                    }}
                  />
                  <span>Mark email as sent</span>
                </label>
              </div>
            )}

            <div className={styles.field}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "5px",
                }}
              >
                <label className={styles.label}>Lead Status</label>
                <button
                  onClick={handleRefreshEntry}
                  className={styles.refreshButton}
                  title="Refresh data from server (e.g., to check for booking updates)"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C10.3869 2 12.4584 3.29441 13.5 5.2M13.5 2V5.2M13.5 5.2H10.3"
                      stroke="url(#gradient)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <defs>
                      <linearGradient
                        id="gradient"
                        x1="2"
                        y1="2"
                        x2="14"
                        y2="14"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0%" stopColor="#e3deea" />
                        <stop offset="100%" stopColor="#edd1d1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </button>
              </div>
              <select
                className={styles.select}
                value={leadStatus}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  setLeadStatus(newStatus);

                  // Lock email if status becomes "Avventer svar"
                  if (newStatus === "Avventer svar" && !emailLocked) {
                    setEmailLocked(true);
                  }

                  // Save to backend
                  if (result?.notionPageId) {
                    try {
                      await fetch(`${API_URL}/api/update`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          pageId: result.notionPageId,
                          leadStatus: newStatus,
                          emailLocked:
                            newStatus === "Avventer svar" ? true : undefined,
                        }),
                      });
                    } catch (error) {
                      console.error("Failed to save lead status:", error);
                    }
                  }
                }}
              >
                <option value="Ikke startet">Ikke startet</option>
                <option value="Pauset">Pauset</option>
                <option value="Vunnet">Vunnet</option>
                <option value="Død lead">Død lead</option>
                <option value="Avventer budsjett / beslutning">
                  Avventer budsjett / beslutning
                </option>
                <option value="Tilbud sendt">Tilbud sendt</option>
                <option value="Forhandling">Forhandling</option>
                <option value="Avventer svar">Avventer svar</option>
              </select>
            </div>

            {(isEmailModified || emailSaved) && (
              <div className={styles.saveButtonContainer}>
                <Button
                  onClick={handleSaveEmail}
                  disabled={savingEmail || emailSaved}
                  loading={savingEmail}
                  loadingText="Saving..."
                >
                  {emailSaved ? "Saved!" : "Save"}
                </Button>
              </div>
            )}

            <div className={styles.actions}>
              <Button
                variant="primary"
                onClick={() => {
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
                }}
              >
                Visit Sanity
              </Button>
              {pitchDeckUrl && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    window.open(pitchDeckUrl, "_blank");
                  }}
                >
                  Presentation
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  // Create LinkedIn Google search URL
                  const companyName = encodeURIComponent(
                    editableCompanyName || ""
                  );
                  const contactName = encodeURIComponent(
                    result.contactPerson || ""
                  );
                  const linkedInSearchUrl = `https://www.google.com/search?q=${companyName}+${contactName}+linkedin`;

                  window.open(linkedInSearchUrl, "_blank");
                }}
              >
                LinkedIn
              </Button>
              {editableEmailContent && (
                <Button
                  variant="secondary"
                  href={isMobile ? mailtoUrl : gmailComposeUrl}
                  target={isMobile ? undefined : "_blank"}
                  rel={isMobile ? undefined : "noopener noreferrer"}
                >
                  Open Gmail
                </Button>
              )}
            </div>

            <div className={styles.success}>
              Entry created in Notion database
            </div>

            {result.sanityPresentationId && (
              <>
                <h3 className={styles.sectionTitle}>
                  Generate & Upload Images
                  {imagesGenerated ? (
                    <span className={styles.generatedIndicator}>
                      <span className={styles.greenDot}></span>
                      <span className={styles.indicatorText}>
                        Generated has been run
                      </span>
                    </span>
                  ) : (
                    <span className={styles.generatedIndicator}>
                      <span className={styles.redDot}></span>
                      <span className={styles.indicatorText}>
                        Not generated yet
                      </span>
                    </span>
                  )}
                </h3>

                <div className={styles.automationSection}>
                  <div className={styles.automationForm}>
                    <div className={styles.field}>
                      <label className={styles.label}>Industry</label>
                      <select
                        className={styles.select}
                        value={automationIndustry}
                        onChange={(e) => setAutomationIndustry(e.target.value)}
                        disabled={runningAutomation}
                      >
                        <option value="Helse">Helse (Health)</option>
                        <option value="Advokat">Advokat (Lawyer)</option>
                        <option value="Bygg">Bygg (Construction)</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Text 1</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={automationText1}
                        onChange={async (e) => {
                          const newValue = e.target.value;
                          setAutomationText1(newValue);

                          // Save to backend
                          if (result?.notionPageId) {
                            try {
                              await fetch(`${API_URL}/api/update`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  pageId: result.notionPageId,
                                  automationText1: newValue,
                                }),
                              });
                            } catch (error) {
                              console.error(
                                "Failed to save automationText1:",
                                error
                              );
                            }
                          }
                        }}
                        placeholder="e.g., Company name"
                        disabled={runningAutomation}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Text 2</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={automationText2}
                        onChange={async (e) => {
                          const newValue = e.target.value;
                          setAutomationText2(newValue);

                          // Save to backend
                          if (result?.notionPageId) {
                            try {
                              await fetch(`${API_URL}/api/update`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  pageId: result.notionPageId,
                                  automationText2: newValue,
                                }),
                              });
                            } catch (error) {
                              console.error(
                                "Failed to save automationText2:",
                                error
                              );
                            }
                          }
                        }}
                        placeholder="e.g., Tagline"
                        disabled={runningAutomation}
                      />
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleRunAutomation}
                      disabled={
                        runningAutomation ||
                        !automationText1 ||
                        !automationText2
                      }
                      loading={runningAutomation}
                      loadingText={automationProgress || "Starting..."}
                    >
                      {imagesGenerated
                        ? "Re-run Image Generator"
                        : "Run Image Generator"}
                    </Button>

                    <p className={styles.instructions}>
                      This will run Photoshop and After Effects to generate
                      images and videos.
                      <br />
                      <strong>Expected time:</strong> 10-40 minutes
                      <br />
                      Files will be automatically uploaded to Sanity when
                      complete.
                    </p>
                  </div>

                  {uploadSuccess && (
                    <div className={styles.success}>
                      All files uploaded successfully to Sanity!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating History Panel */}
      <HistoryPanel
        onLoadEntry={handleLoadHistoryEntry}
        currentEntryId={result?.notionPageId}
        onDeleteCurrentEntry={async () => {
          // Show full-screen spinner
          setDeleting(true);

          // Small delay to ensure spinner is visible
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Clear all states to reset the page
          setResult(null);
          setPitchDeckUrl("");
          setEditableCompanyName("");
          setEditableEmail("");
          setEditablePhone("");
          setEditableAddress("");
          setEditableCity("");
          setEditableLinkedIn("");
          setEditableEmailContent("");
          setAutomationText1("");
          setAutomationText2("");
          setAutomationIndustry("Helse");
          setImagesGenerated(false);
          setEmailSent(false);
          setError("");
          setIsEmailModified(false);
          setEmailSaved(false);
          setProffUrl("");
          // Clear saved state when deleting current entry
          localStorage.removeItem("generator_savedState");

          // Hide spinner after a short delay
          setTimeout(() => setDeleting(false), 300);
        }}
      />

      <AlertModal
        isOpen={showLogoDeleteModal}
        title="Slett logo"
        message="Er du sikker på at du vil slette denne logoen?"
        confirmText="Slett logo"
        cancelText="Avbryt"
        onConfirm={confirmLogoDelete}
        onCancel={() => setShowLogoDeleteModal(false)}
        confirmButtonStyle="danger"
      />

      <AlertModal
        isOpen={showAlertModal}
        title={alertTitle}
        message={alertMessage}
        confirmText="OK"
        onConfirm={() => setShowAlertModal(false)}
        confirmButtonStyle="light"
      />
    </div>
  );
};

export default Generator;
