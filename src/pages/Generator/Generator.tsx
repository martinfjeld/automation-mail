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
  linkedIn?: string;
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

// Separate RollingDigit for startup percentage with custom sizing
const StartupRollingDigit: React.FC<{
  digit: string;
  index: number;
  timeKey: string;
  fontSize: number;
}> = ({ digit, index, timeKey, fontSize }) => {
  const rollerRef = useRef<HTMLSpanElement>(null);
  const prevTimeKeyRef = useRef<string>("");

  useEffect(() => {
    if (!rollerRef.current) return;
    if (prevTimeKeyRef.current !== timeKey) {
      const targetDigit = parseInt(digit);
      if (!isNaN(targetDigit)) {
        const digitHeight = fontSize * 1.2; // Line height ratio
        const translateY = -targetDigit * digitHeight;
        rollerRef.current.style.transform = `translateY(${translateY}px)`;
      }
      prevTimeKeyRef.current = timeKey;
    }
  }, [timeKey, digit, fontSize]);

  if (digit === ":" || digit === " ") {
    return <span className={styles.digitSeparator}>{digit}</span>;
  }

  const digitHeight = fontSize * 1.2;
  const digitWidth = fontSize * 0.65;

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: `${digitHeight}px`,
        width: `${digitWidth}px`,
        overflow: "hidden",
        position: "relative",

        borderRadius: "6px",
      }}
    >
      <span
        ref={rollerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          fontSize: `${fontSize}px`,
          fontFamily: '"Europa Grotesk SH", sans-serif',
          fontWeight: 600,
          transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          willChange: "transform",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span
            key={num}
            style={{
              height: `${digitHeight}px`,
              lineHeight: `${digitHeight}px`,
              fontSize: `${fontSize}px`,
              display: "block",
              textAlign: "center",
              color: "#ffffff",
              width: "100%",
              flexShrink: 0,
            }}
          >
            {num}
          </span>
        ))}
      </span>
    </span>
  );
};

const RollingPercentage: React.FC<{ percentage: number }> = ({
  percentage,
}) => {
  const roundedPercent = Math.round(percentage);
  const percentString = roundedPercent.toString();
  const percentKey = percentString; // Use as key to trigger animations

  // CHANGE FONT SIZE HERE - This controls the size of startup digits
  const STARTUP_DIGIT_SIZE = 290; // Change this value to resize all digits
  const digitWidth = STARTUP_DIGIT_SIZE * 0.65;

  // Determine how many digits to show (1, 2, or 3)
  const showHundreds = roundedPercent >= 100;
  const showTens = roundedPercent >= 10;

  return (
    <div className={styles.rollingPercentage}>
      {/* Hundreds digit - only show if >= 100 */}
      <span
        style={{
          width: showHundreds ? `${digitWidth}px` : "0px",
          overflow: "hidden",
          transition: "width 0.3s ease",
          display: "inline-block",
        }}
      >
        {showHundreds && (
          <StartupRollingDigit
            key={`percent-hundreds`}
            digit={percentString[percentString.length - 3] || "0"}
            index={0}
            timeKey={percentKey}
            fontSize={STARTUP_DIGIT_SIZE}
          />
        )}
      </span>

      {/* Tens digit - only show if >= 10 */}
      <span
        style={{
          width: showTens ? `${digitWidth}px` : "0px",
          overflow: "hidden",
          transition: "width 0.3s ease",
          display: "inline-block",
        }}
      >
        {showTens && (
          <StartupRollingDigit
            key={`percent-tens`}
            digit={
              roundedPercent >= 100
                ? percentString[percentString.length - 2]
                : percentString[0]
            }
            index={1}
            timeKey={percentKey}
            fontSize={STARTUP_DIGIT_SIZE}
          />
        )}
      </span>

      {/* Ones digit - always show */}
      <StartupRollingDigit
        key={`percent-ones`}
        digit={percentString[percentString.length - 1]}
        index={2}
        timeKey={percentKey}
        fontSize={STARTUP_DIGIT_SIZE}
      />

      <span
        className={styles.percentSymbol}
        style={{ fontSize: `${STARTUP_DIGIT_SIZE * 0.5}px` }}
      >
        %
      </span>
    </div>
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorRed, setSaveErrorRed] = useState(false);
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
  const [sanityLogoUrl, setSanityLogoUrl] = useState<string | null>(null);
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
  const [showBanModal, setShowBanModal] = useState(false);
  const [companyToBan, setCompanyToBan] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [startingUp, setStartingUp] = useState(true);
  const [startupProgress, setStartupProgress] = useState(0);
  const [startupMessage, setStartupMessage] = useState(
    "Starter opp Salgsautomator..."
  );

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

  // Startup: Wait for server to be ready (only on first load of session)
  useEffect(() => {
    const checkServerHealth = async () => {
      // Ensure we're showing the startup screen
      setStartingUp(true);

      // Quick check if server was recently verified (skip full loading sequence)
      const serverReady = sessionStorage.getItem("serverReady");
      if (serverReady === "true") {
        // Do a quick health check to confirm server is still up
        try {
          const response = await fetch(`${LOCAL_API_URL}/api/proff-queue`, {
            signal: AbortSignal.timeout(1000),
          });
          if (response.ok) {
            // Server is still responding, skip full startup sequence
            setStartingUp(false);
            return;
          }
        } catch (error) {
          // Server not responding, continue with full health check
          console.log("Server not responding, showing startup screen...");
        }
        // Clear the cached flag if server is down
        sessionStorage.removeItem("serverReady");
      }

      let retries = 0;
      const maxRetries = 30; // 30 seconds max

      setStartupProgress(5);
      setStartupMessage("Kobler til server...");

      while (retries < maxRetries) {
        try {
          const response = await fetch(`${LOCAL_API_URL}/api/proff-queue`, {
            signal: AbortSignal.timeout(2000),
          });

          if (response.ok) {
            setStartupProgress(70);
            setStartupMessage("Laster historikk...");

            // Load history
            await new Promise((resolve) => setTimeout(resolve, 300));

            setStartupProgress(95);
            setStartupMessage("Klar!");

            // Smooth transition to 100
            await new Promise((resolve) => setTimeout(resolve, 200));
            setStartupProgress(100);

            // Wait a bit to show completion
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Remember that server is ready for this session
            sessionStorage.setItem("serverReady", "true");

            setStartingUp(false);
            return;
          }
        } catch (error) {
          // Server not ready yet
        }

        retries++;
        const progress = 5 + (retries / maxRetries) * 60;
        setStartupProgress(Math.min(Math.round(progress), 65));
        setStartupMessage(`Venter på server... (${retries}/${maxRetries})`);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Timeout - show error but allow app to load
      setStartupProgress(80);
      setStartupMessage("Kunne ikke koble til server. Fortsetter likevel...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      sessionStorage.setItem("serverReady", "true"); // Don't show again this session
      setStartingUp(false);
    };

    checkServerHealth();
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // localStorage functionality removed - always start fresh on page load

  // Warn user before leaving during active generation or with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading || runningAutomation || hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loading, runningAutomation, hasUnsavedChanges]);

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
    setEditableLinkedIn(result?.linkedIn || "");
    setEditableEmailContent(result?.emailContent || "");
    setIsEmailModified(false);
    console.log("useEffect - after setEditableEmailContent");
  }, [result, isLoadingHistory]);

  // Reset save status when any field changes
  useEffect(() => {
    if (emailSaved) {
      setEmailSaved(false);
    }
    if (saveError) {
      setSaveError(null);
      setSaveErrorRed(false);
    }
  }, [
    editableCompanyName,
    editableEmail,
    editablePhone,
    editableAddress,
    editableCity,
    editableLinkedIn,
    editableEmailContent,
    meetingDate1,
    meetingDate2,
    meetingDate3,
    logoMode,
  ]);

  // Poll for updates to the current entry (e.g., booking confirmations)
  useEffect(() => {
    if (!result?.notionPageId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${LOCAL_API_URL}/api/history`);
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

              // Update møtedato if there's a booking
              if (hasBookingUpdate) {
                console.log("🎉 Meeting booked:", currentEntry.møtedato);
                setMøtedato(currentEntry.møtedato);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll for updates:", error);
      }
    }, 15000); // Poll every 15 seconds (reduced frequency to minimize performance impact)

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
      // Save to history.json only (local, no rate limits)
      // Notion/Sanity sync is manual via "Refresh notion" button

      if (!result?.notionPageId) return;

      try {
        console.log(`💾 Saving logo mode to history.json...`);
        await fetch(`${LOCAL_API_URL}/api/history`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageId: result.notionPageId,
            logoMode: mode,
          }),
        });
        console.log(`✅ Logo mode saved to history`);
      } catch (err: any) {
        console.error(`❌ History save error:`, err.message);
      }
    },
    [result?.notionPageId]
  );

  // Fetch Sanity logo URL
  const fetchSanityLogo = useCallback(async (presentationId: string) => {
    try {
      console.log(
        `🔍 Fetching Sanity logo for presentation: ${presentationId}`
      );
      const response = await fetch(
        `${LOCAL_API_URL}/api/sanity/logo/${presentationId}`
      );
      const data = await response.json();

      if (data.success && data.logoUrl) {
        console.log("✅ Sanity logo URL found:", data.logoUrl);
        setSanityLogoUrl(data.logoUrl);
      } else {
        console.log("❌ No Sanity logo found");
        setSanityLogoUrl(null);
      }
    } catch (error) {
      console.error("Failed to fetch Sanity logo:", error);
      setSanityLogoUrl(null);
    }
  }, []);

  // Load Sanity logo when result changes
  useEffect(() => {
    if (result?.sanityPresentationId) {
      fetchSanityLogo(result.sanityPresentationId);
    } else {
      setSanityLogoUrl(null);
    }
  }, [result?.sanityPresentationId, fetchSanityLogo]);

  // Manual sync function to update all changes to Notion/Sanity at once
  const syncToNotion = useCallback(async () => {
    if (!result?.notionPageId) return;

    setSyncing(true);
    try {
      console.log("🔄 Syncing: Local → Sanity → Notion...");

      const requestBody = {
        pageId: result.notionPageId,
        companyName: editableCompanyName,
        contactPerson: result.contactPerson,
        email: editableEmail,
        phone: editablePhone,
        address: editableAddress,
        city: editableCity,
        linkedIn: editableLinkedIn,
        website: result.website,
        emailContent: editableEmailContent,
        meetingDates: [meetingDate1, meetingDate2, meetingDate3],
        logoMode: logoMode,
        sanityPresentationId: result.sanityPresentationId,
        sanityUniqueId: result.sanityUniqueId,
      };

      console.log("📤 Syncing to production:", requestBody);

      // Use the local API which has Notion credentials and latest code
      const response = await fetch(`${LOCAL_API_URL}/api/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error response:", errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.success) {
        console.log("✅ Sync complete:", {
          historyUpdated: true,
          sanityUpdated: true,
          notionSuccess: data.notionSuccess,
        });
        if (data.presentationUrl) {
          setPitchDeckUrl(data.presentationUrl);
        }
        setHasUnsavedChanges(false);

        if (data.notionSuccess) {
          alert(
            "✅ Alle endringer synkronisert til history.json, Sanity og Notion!"
          );
        } else {
          alert(
            "⚠️ Synkronisert til history.json og Sanity. Notion feilet, men lokale endringer er bevart."
          );
        }
      } else {
        console.warn("⚠️ Sync returned non-success:", data);
        alert("⚠️ Synkronisering fullført med advarsler. Sjekk konsollen.");
      }
    } catch (err: any) {
      console.error("❌ Sync error:", err.message);
      alert(
        "❌ Kunne ikke synkronisere. Lokale endringer i history.json bevart."
      );
    } finally {
      setSyncing(false);
    }
  }, [
    result?.notionPageId,
    result?.sanityPresentationId,
    result?.sanityUniqueId,
    result?.contactPerson,
    result?.website,
    logoMode,
    editableCompanyName,
    editableEmail,
    editablePhone,
    editableAddress,
    editableCity,
    editableLinkedIn,
    editableEmailContent,
    meetingDate1,
    meetingDate2,
    meetingDate3,
  ]);

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
      const response = await fetch(
        `${LOCAL_API_URL}/api/proff-queue/search-url`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ searchUrl: newUrl }),
        }
      );
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
      // Wait for server to be ready before loading queue
      const serverReady = sessionStorage.getItem("serverReady");
      if (serverReady !== "true") {
        // Wait for startup to complete
        const checkInterval = setInterval(() => {
          if (sessionStorage.getItem("serverReady") === "true") {
            clearInterval(checkInterval);
            loadAndRefillQueue();
          }
        }, 100);
        return;
      }

      try {
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
      } catch (error) {
        console.log("Queue loading will retry after server is ready");
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

  // Show ban confirmation modal
  const handleBanCompany = (company: any) => {
    setCompanyToBan(company);
    setShowBanModal(true);
  };

  // Confirm and execute ban
  const confirmBanCompany = async () => {
    if (!companyToBan) return;

    setShowBanModal(false);

    try {
      const response = await fetch(`${LOCAL_API_URL}/api/proff-queue/ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: companyToBan.id,
          proffUrl: companyToBan.proffUrl,
          companyName: companyToBan.companyName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`🚫 Banned ${companyToBan.companyName}`);

        // Refresh queue to show updated list
        await fetchProffQueue();

        // Try to refill if queue is getting low
        if (proffQueue.length < 10) {
          await refillProffQueue();
        }

        // Force UI update
        setQueueUpdateKey((prev) => prev + 1);
      } else {
        throw new Error(data.error || "Failed to ban company");
      }
    } catch (error) {
      console.error("Failed to ban company:", error);
      setAlertTitle("Feil");
      setAlertMessage("Kunne ikke legge til i sperrelisten");
      setShowAlertModal(true);
    } finally {
      setCompanyToBan(null);
    }
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
                console.error(
                  "Failed to save imagesGenerated flag to local backend:",
                  error
                );
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
                console.log(
                  "✅ Saved imagesGenerated flag to production backend"
                );
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

    console.log("🔵 ========== SAVE BUTTON CLICKED ==========");
    console.log("🔵 Page ID:", result.notionPageId);
    console.log("🔵 Timestamp:", new Date().toISOString());

    setSavingEmail(true);
    try {
      console.log(
        "💾 Save button: Syncing all fields to history.json, Sanity, and Notion..."
      );

      const requestBody = {
        pageId: result.notionPageId,
        companyName: editableCompanyName,
        contactPerson: result.contactPerson,
        email: editableEmail,
        phone: editablePhone,
        address: editableAddress,
        city: editableCity,
        linkedIn: editableLinkedIn,
        website: result.website,
        emailContent: editableEmailContent,
        meetingDates: [meetingDate1, meetingDate2, meetingDate3],
        logoMode: logoMode,
        sanityPresentationId: result.sanityPresentationId,
        sanityUniqueId: result.sanityUniqueId,
      };

      console.log("🔵 Request body:", JSON.stringify(requestBody, null, 2));
      console.log("🔵 Calling:", `${LOCAL_API_URL}/api/update`);

      const requestStartTime = Date.now();

      // Use the local API which has Notion credentials and latest code
      const response = await fetch(`${LOCAL_API_URL}/api/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log("🔵 Response received in", requestDuration, "ms");

      const data = await response.json();

      console.log("🔵 Response status:", response.status);
      console.log("🔵 Response data:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("🔴 Request failed:", data.error);
        throw new Error(data.error || "Failed to save");
      }

      // Update result state with all current values
      setResult((prev) =>
        prev
          ? {
              ...prev,
              companyName: editableCompanyName,
              email: editableEmail,
              phone: editablePhone,
              address: editableAddress,
              city: editableCity,
              linkedIn: editableLinkedIn,
              emailContent: editableEmailContent,
            }
          : prev
      );

      if (data.presentationUrl) {
        setPitchDeckUrl(data.presentationUrl);
      }

      setIsEmailModified(false);
      setHasUnsavedChanges(false);
      setSaveError(null);

      // Check for partial failures
      if (!data.notionSuccess) {
        setSaveError("Notion sync failed");
        setSaveErrorRed(true);
        console.warn(
          "⚠️ Synced to history.json and Sanity. Notion failed but local changes preserved."
        );
        // Still show "Saved" since data is preserved locally and in Sanity
        setEmailSaved(true);
        // Fade from red back to normal after 3 seconds, clear message after 5
        setTimeout(() => setSaveErrorRed(false), 3000);
        setTimeout(() => setSaveError(null), 5000);
        setTimeout(() => setEmailSaved(false), 2000);
      } else {
        console.log(
          "✅ All changes synced to history.json, Sanity, and Notion!"
        );
        setEmailSaved(true);
        // Hide success message after 2 seconds
        setTimeout(() => setEmailSaved(false), 2000);
      }

      console.log("🔵 ========== SAVE COMPLETE ==========");
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(`Failed: ${err.message}`);
      setSaveErrorRed(true);
      // Fade from red back to normal after 3 seconds, clear message after 5
      setTimeout(() => setSaveErrorRed(false), 3000);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSavingEmail(false);
    }
  };

  // Debounced auto-save for contact fields
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const autoSaveContactField = useCallback(
    (fieldName: string, value: string) => {
      // Save to history.json only (local, no rate limits)
      // Notion/Sanity sync is manual via "Refresh notion" button

      if (!result?.notionPageId) return;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          console.log(`💾 Saving ${fieldName} to history.json...`);
          await fetch(`${LOCAL_API_URL}/api/history`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              [fieldName]: value,
            }),
          });
          console.log(`✅ ${fieldName} saved to history`);
        } catch (err: any) {
          console.error(`❌ History save error:`, err.message);
        }
      }, 500);
    },
    [result?.notionPageId]
  );

  // Auto-save meeting dates to history
  const autoSaveMeetingDates = useCallback(
    (dates: [string, string, string]) => {
      // Save to history.json only (local, no rate limits)
      // Notion/Sanity sync is manual via "Refresh notion" button

      if (!result?.notionPageId) return;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("💾 Saving meeting dates to history.json...");
          await fetch(`${LOCAL_API_URL}/api/history`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              meetingDates: dates,
            }),
          });
          console.log("✅ Meeting dates saved to history");
        } catch (err: any) {
          console.error("❌ History save error:", err.message);
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

      // Auto-save to history.json (local only, no rate limits)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("💾 Saving company name to history.json...");
          await fetch(`${LOCAL_API_URL}/api/history`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pageId: result.notionPageId,
              companyName: value,
            }),
          });
          console.log("✅ Company name saved to history");
        } catch (err: any) {
          console.error("❌ History save error:", err.message);
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
    console.log("LinkedIn from entry:", entry.linkedIn);
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
      linkedIn: entry.linkedIn,
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
    setEditableLinkedIn(entry.linkedIn || "");
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

  const handleDeleteCurrentEntry = useCallback(async () => {
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

  // Show startup loading screen
  if (startingUp) {
    return (
      <div className={styles.startupScreen}>
        <Helmet>
          <title>Starter opp...</title>
        </Helmet>
        <div className={styles.startupContent}>
          <RollingPercentage percentage={startupProgress} />
        </div>
        <div className={styles.startupFooter}>© 2026 No offence</div>
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
                    <svg
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.sparkleIcon}
                    >
                      <path
                        d="M10 4 L10.5 9 L11 9.5 L16 10 L11 10.5 L10.5 11 L10 16 L9.5 11 L9 10.5 L4 10 L9 9.5 L9.5 9 Z"
                        fill="currentColor"
                      />
                      <path
                        d="M5 5 L5.3 6.5 L5.7 6.8 L7.2 7 L5.7 7.2 L5.3 7.5 L5 9 L4.7 7.5 L4.3 7.2 L2.8 7 L4.3 6.8 L4.7 6.5 Z"
                        fill="currentColor"
                      />
                      <path
                        d="M15 13 L15.2 14.5 L15.5 14.7 L17 15 L15.5 15.3 L15.2 15.5 L15 17 L14.8 15.5 L14.5 15.3 L13 15 L14.5 14.7 L14.8 14.5 Z"
                        fill="currentColor"
                      />
                    </svg>
                    {loadingQueue ? "Laster..." : "Last inn bedrifter"}
                  </button>
                  {proffQueue.length > 0 && !batchGenerating && (
                    <button
                      onClick={handleGenerateAll}
                      disabled={loading || loadingQueue}
                      className={styles.generateAllButton}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                        className={styles.sparkleIcon}
                      >
                        <path
                          d="M10 4 L10.5 9 L11 9.5 L16 10 L11 10.5 L10.5 11 L10 16 L9.5 11 L9 10.5 L4 10 L9 9.5 L9.5 9 Z"
                          fill="currentColor"
                        />
                        <path
                          d="M5 5 L5.3 6.5 L5.7 6.8 L7.2 7 L5.7 7.2 L5.3 7.5 L5 9 L4.7 7.5 L4.3 7.2 L2.8 7 L4.3 6.8 L4.7 6.5 Z"
                          fill="currentColor"
                        />
                        <path
                          d="M15 13 L15.2 14.5 L15.5 14.7 L17 15 L15.5 15.3 L15.2 15.5 L15 17 L14.8 15.5 L14.5 15.3 L13 15 L14.5 14.7 L14.8 14.5 Z"
                          fill="currentColor"
                        />
                      </svg>
                      x {proffQueue.length}
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
                    <span className={styles.sourceUrlText}>
                      {searchUrl || "Ingen URL satt"}
                    </span>
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
                    <div
                      key={`${company.id}-${queueUpdateKey}-${index}`}
                      className={styles.queueItem}
                    >
                      <div className={styles.buttonGroup}>
                        <button
                          onClick={() => handleGenerateFromQueue(company)}
                          disabled={loading || loadingQueue || batchGenerating}
                          className={styles.generateButton}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                            className={styles.sparkleIcon}
                          >
                            <path
                              d="M10 4 L10.5 9 L11 9.5 L16 10 L11 10.5 L10.5 11 L10 16 L9.5 11 L9 10.5 L4 10 L9 9.5 L9.5 9 Z"
                              fill="currentColor"
                            />
                            <path
                              d="M5 5 L5.3 6.5 L5.7 6.8 L7.2 7 L5.7 7.2 L5.3 7.5 L5 9 L4.7 7.5 L4.3 7.2 L2.8 7 L4.3 6.8 L4.7 6.5 Z"
                              fill="currentColor"
                            />
                            <path
                              d="M15 13 L15.2 14.5 L15.5 14.7 L17 15 L15.5 15.3 L15.2 15.5 L15 17 L14.8 15.5 L14.5 15.3 L13 15 L14.5 14.7 L14.8 14.5 Z"
                              fill="currentColor"
                            />
                          </svg>
                          Generer
                        </button>
                      </div>
                      <span className={styles.companyName}>
                        {company.companyName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBanCompany(company);
                        }}
                        disabled={loading || loadingQueue || batchGenerating}
                        className={styles.removeButton}
                        title="Legg til i sperrelisten"
                      >
                        Slett
                      </button>
                    </div>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2 className={styles.resultTitle} style={{ margin: 0 }}>
                Generated Email
              </h2>
            </div>

            <div className={styles.info}>
              <div className={styles.companyRow}>
                <div
                  className={styles.companyInfo}
                  style={{ position: "relative" }}
                >
                  <div className={styles.infoItem}>
                    <strong>Company:</strong>{" "}
                    <input
                      type="text"
                      className={styles.inlineEditable}
                      value={editableCompanyName}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableCompanyName(newValue);
                        setHasUnsavedChanges(true);
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
                        setHasUnsavedChanges(true);
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
                          setHasUnsavedChanges(true);
                          autoSaveContactField("phone", newValue);
                        }}
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <strong>Address:</strong>{" "}
                    <input
                      type="text"
                      className={styles.inlineEditable}
                      placeholder="Enter address"
                      value={editableAddress}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableAddress(newValue);
                        setHasUnsavedChanges(true);
                        autoSaveContactField("address", newValue);
                      }}
                      disabled={loading}
                    />
                  </div>
                  <div className={styles.infoItem}>
                    <strong>City:</strong>{" "}
                    <input
                      type="text"
                      className={styles.inlineEditable}
                      placeholder="Enter city"
                      value={editableCity}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableCity(newValue);
                        setHasUnsavedChanges(true);
                        autoSaveContactField("city", newValue);
                      }}
                      disabled={loading}
                    />
                  </div>
                  <div className={styles.infoItem}>
                    <strong>LinkedIn:</strong>{" "}
                    <input
                      type="text"
                      className={styles.inlineEditable}
                      placeholder="Enter LinkedIn profile URL"
                      value={editableLinkedIn}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditableLinkedIn(newValue);
                        setHasUnsavedChanges(true);
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
                                  setHasUnsavedChanges(true);
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
                                  setHasUnsavedChanges(true);
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
                                  setHasUnsavedChanges(true);
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

                  {/* Save Button - positioned at bottom left */}
                </div>

                <div className={styles.logoColumn}>
                  <div className={styles.logoSection}>
                    {(sanityLogoUrl || result.logoUrl) && (
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
                              setHasUnsavedChanges(true);
                              autoSaveLogoMode("light");
                            }}
                          >
                            <img
                              src={sanityLogoUrl || result.logoUrl}
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
                              setHasUnsavedChanges(true);
                              autoSaveLogoMode("dark");
                            }}
                          >
                            <img
                              src={sanityLogoUrl || result.logoUrl}
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
                      {(sanityLogoUrl || result.logoUrl) && (
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
                          : sanityLogoUrl || result.logoUrl
                          ? "Replace Logo"
                          : "Upload Logo"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  bottom: "16px",
                  right: "16px",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    backgroundColor: saveErrorRed
                      ? "#ff4444"
                      : emailSaved
                      ? "#6b7280"
                      : "#ffffff",
                    color: saveErrorRed
                      ? "#ffffff"
                      : emailSaved
                      ? "#ffffff"
                      : "#000000",
                    border: saveErrorRed
                      ? "1px solid #ff4444"
                      : emailSaved
                      ? "1px solid #6b7280"
                      : "1px solid #ddd",
                    borderRadius: "999px",
                    padding: "14px 32px",
                    cursor:
                      savingEmail || emailSaved ? "not-allowed" : "pointer",
                    transition: "all 0.8s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: "600",
                    fontFamily: '"Europa Grotesk SH", sans-serif',
                    opacity: savingEmail || emailSaved ? 0.7 : 1,
                    userSelect: "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onClick={handleSaveEmail}
                  onMouseEnter={(e) => {
                    if (!(savingEmail || emailSaved)) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.opacity = "0.9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(savingEmail || emailSaved)) {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.opacity = "1";
                    }
                  }}
                >
                  {savingEmail && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: "-100%",
                          width: "100%",
                          height: "100%",
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.15) 100%)",
                          animation: "slideRight 1.5s ease-in-out infinite",
                          zIndex: 1,
                        }}
                      />
                      <style>
                        {`
                              @keyframes slideRight {
                                0% { left: -100%; }
                                100% { left: 100%; }
                              }
                            `}
                      </style>
                    </>
                  )}
                  <span style={{ position: "relative", zIndex: 2 }}>
                    {saveError
                      ? saveError
                      : emailSaved
                      ? "Saved"
                      : savingEmail
                      ? "Saving..."
                      : "Save"}
                  </span>
                </div>
              </div>
              {showLogoPreview && (sanityLogoUrl || result.logoUrl) && (
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
                      src={sanityLogoUrl || result.logoUrl}
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
                const newValue = e.target.value;
                setEditableEmailContent(newValue);
                setIsEmailModified(true);
                setHasUnsavedChanges(true);

                // Auto-save email content to history.json
                if (updateTimeoutRef.current) {
                  clearTimeout(updateTimeoutRef.current);
                }

                updateTimeoutRef.current = setTimeout(async () => {
                  if (!result?.notionPageId) return;
                  try {
                    console.log("💾 Saving email content to history.json...");
                    await fetch(`${LOCAL_API_URL}/api/history`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        pageId: result.notionPageId,
                        emailContent: newValue,
                      }),
                    });
                    console.log("✅ Email content saved to history");
                  } catch (err: any) {
                    console.error("❌ History save error:", err.message);
                  }
                }, 500);
              }}
              rows={15}
              disabled={emailLocked || emailSent || !!møtedato}
            />

            {!emailLocked && !møtedato && (
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

                      // Save to backend (local state already updated above)
                      if (result?.notionPageId) {
                        try {
                          // Calculate dates
                          const now = new Date();
                          const contactDate = now.toISOString().split("T")[0];
                          
                          const followUpDate = new Date(now);
                          followUpDate.setDate(followUpDate.getDate() + 7);
                          const followUp = followUpDate.toISOString().split("T")[0];

                          console.log("📅 Setting dates:", {
                            contactDate,
                            followUp,
                            emailSent: newValue
                          });

                          const response = await fetch(
                            `${LOCAL_API_URL}/api/update`,
                            {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                pageId: result.notionPageId,
                                emailSent: newValue,
                                leadStatus: newLeadStatus,
                                contactDate: newValue ? contactDate : undefined,
                                followUpDate: newValue ? followUp : undefined,
                              }),
                            }
                          );
                          const data = await response.json();
                          if (data.success) {
                            console.log("✅ Email sent flag saved to backend");
                          }
                        } catch (error: any) {
                          console.error(
                            "❌ Failed to save emailSent flag (local state preserved):",
                            error.message
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

                  // Debounce API call to prevent rate limiting
                  if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                  }

                  updateTimeoutRef.current = setTimeout(async () => {
                    // Save to backend (local state already updated above)
                    if (result?.notionPageId) {
                      try {
                        const response = await fetch(`${API_URL}/api/update`, {
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
                        const data = await response.json();
                        if (data.success) {
                          console.log(
                            `✅ Lead status '${newStatus}' saved to backend`
                          );
                        }
                      } catch (error: any) {
                        console.error(
                          "❌ Failed to save lead status (local state preserved):",
                          error.message
                        );
                      }
                    }
                  }, 800); // 800ms delay to prevent rate limiting
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

                          // Save to backend (local state already updated above)
                          if (result?.notionPageId) {
                            try {
                              const response = await fetch(
                                `${API_URL}/api/update`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    pageId: result.notionPageId,
                                    automationText1: newValue,
                                  }),
                                }
                              );
                              const data = await response.json();
                              if (data.success) {
                                console.log(
                                  "✅ Automation text 1 saved to backend"
                                );
                              }
                            } catch (error: any) {
                              console.error(
                                "❌ Failed to save automationText1 (local state preserved):",
                                error.message
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

                          // Save to backend (local state already updated above)
                          if (result?.notionPageId) {
                            try {
                              const response = await fetch(
                                `${API_URL}/api/update`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    pageId: result.notionPageId,
                                    automationText2: newValue,
                                  }),
                                }
                              );
                              const data = await response.json();
                              if (data.success) {
                                console.log(
                                  "✅ Automation text 2 saved to backend"
                                );
                              }
                            } catch (error: any) {
                              console.error(
                                "❌ Failed to save automationText2 (local state preserved):",
                                error.message
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
        onDeleteCurrentEntry={handleDeleteCurrentEntry}
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
        isOpen={showBanModal}
        title="Legg til i sperrelisten"
        message={`Er du sikker på at du vil legge til ${
          companyToBan?.companyName || "dette firmaet"
        } i sperrelisten? Dette firmaet vil ikke dukke opp i køen igjen.`}
        confirmText="Ja, legg til"
        cancelText="Avbryt"
        onConfirm={confirmBanCompany}
        onCancel={() => {
          setShowBanModal(false);
          setCompanyToBan(null);
        }}
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
