import React, { useState, useEffect, useCallback, useRef } from "react";
import Button from "../../components/Button/Button";
import HistoryPanel from "../../components/HistoryPanel/HistoryPanel";
import AlertModal from "../../components/AlertModal/AlertModal";
import styles from "./Generator.module.scss";
import { API_URL } from "../../config";
import trashIcon from "../../assets/image.png";

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showLogoPreview, setShowLogoPreview] = useState(false);
  const [isClosingPreview, setIsClosingPreview] = useState(false);
  const [logoMode, setLogoMode] = useState<"light" | "dark">("light");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId] = useState(
    () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("generator_savedState");
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        console.log("Restoring saved state:", parsedState);
        
        // Set loading flag to prevent useEffect from interfering
        setIsLoadingHistory(true);

        // Restore the result
        if (parsedState.result) {
          setResult(parsedState.result);
          setEditableCompanyName(parsedState.result.companyName || "");
          setEditableEmail(parsedState.result.email || "");
          setEditablePhone(parsedState.result.phone || "");
          setEditableAddress(parsedState.result.address || "");
          setEditableCity(parsedState.result.city || "");
          setEditableEmailContent(parsedState.result.emailContent || "");
        }

        // Restore other fields
        if (parsedState.service) setService(parsedState.service);
        if (parsedState.pitchDeckUrl) setPitchDeckUrl(parsedState.pitchDeckUrl);
        if (parsedState.automationIndustry) setAutomationIndustry(parsedState.automationIndustry);
        if (parsedState.automationText1) setAutomationText1(parsedState.automationText1);
        if (parsedState.automationText2) setAutomationText2(parsedState.automationText2);
        if (parsedState.imagesGenerated !== undefined) setImagesGenerated(parsedState.imagesGenerated);
        if (parsedState.emailSent !== undefined) setEmailSent(parsedState.emailSent);
        if (parsedState.leadStatus) setLeadStatus(parsedState.leadStatus);

        // Clear loading flag after a brief delay
        setTimeout(() => setIsLoadingHistory(false), 100);
      } catch (error) {
        console.error("Failed to restore saved state:", error);
      }
    }
  }, []);

  // Save state to localStorage whenever result or related fields change
  useEffect(() => {
    if (result && !isLoadingHistory) {
      const stateToSave = {
        result,
        service,
        pitchDeckUrl,
        automationIndustry,
        automationText1,
        automationText2,
        imagesGenerated,
        emailSent,
        leadStatus,
      };
      localStorage.setItem("generator_savedState", JSON.stringify(stateToSave));
    }
  }, [result, service, pitchDeckUrl, automationIndustry, automationText1, automationText2, imagesGenerated, emailSent, leadStatus, isLoadingHistory]);

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

  // Auto-copy company name to clipboard when result loads
  useEffect(() => {
    if (result?.companyName) {
      navigator.clipboard.writeText(result.companyName).catch((err) => {
        console.warn("Failed to copy to clipboard:", err);
      });
    }
  }, [result]);

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
    // Clear saved state when generating new content
    localStorage.removeItem("generator_savedState");

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
              console.log("✅ Generation response data:", data.data);
              console.log("✅ Meeting dates:", data.data.meetingDates);
              console.log("✅ Booking links:", data.data.bookingLinks);
              setResult(data.data);
              // Automatically set pitch deck URL if available
              if (data.data.presentationUrl) {
                setPitchDeckUrl(data.data.presentationUrl);
              }
              // Load meeting dates and booking links
              if (data.data.meetingDates) {
                setMeetingDate1(data.data.meetingDates[0] || "");
                setMeetingDate2(data.data.meetingDates[1] || "");
                setMeetingDate3(data.data.meetingDates[2] || "");
                console.log("✅ Set meeting dates:", data.data.meetingDates[0], data.data.meetingDates[1], data.data.meetingDates[2]);
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
      `${API_URL}/api/progress/stream?clientId=${clientId}`
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

          // Save imagesGenerated flag to backend
          if (result?.notionPageId) {
            fetch(`${API_URL}/api/update`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pageId: result.notionPageId,
                imagesGenerated: true,
              }),
            })
              .then(() => {
                console.log("✅ Saved imagesGenerated flag to backend");
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
      const response = await fetch(`${API_URL}/api/automation/run`, {
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

      if (data.success) {
        // Trigger file upload after automation completes
        await handleUploadGeneratedFiles(data.finalsPath, data.rendersPath);
      } else {
        setError(data.error || "Failed to run automation");
        setRunningAutomation(false);
        setAutomationProgress("");
      }

      eventSource.close();
    } catch (error) {
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
      setRunningAutomation(false);
      setAutomationProgress("");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/files/upload-generated`, {
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
      });

      const data = await response.json();

      if (data.success) {
        setUploadSuccess(true);
        setAutomationProgress("");
        console.log("Uploaded files:", data.uploadedFiles);
      } else {
        setError(data.error || "Failed to upload generated files");
        setAutomationProgress("");
      }
    } catch (error) {
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

  if (checkingSetup) {
    return (
      <div className={styles.generator}>
        <div className={styles.container}>
          <p>Sjekker oppsett...</p>
        </div>
      </div>
    );
  }

  if (deleting) {
    return (
      <div className={styles.generator}>
        <div className={styles.deletingOverlay}>
          <div className={styles.spinner}></div>
          <p>Sletter...</p>
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
            Generer e-post
          </Button>
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
                  {result.email && (
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
                  {(meetingDate1 || meetingDate2 || meetingDate3) && (
                    <div className={styles.meetingDatesSection}>
                      <strong>Meeting Proposals:</strong>
                      <div className={styles.meetingDates}>
                        <div className={styles.datePickerItem}>
                          <label>Slot 1:</label>
                          <input
                            type="datetime-local"
                            className={styles.inlineEditable}
                            value={meetingDate1 ? (() => { const d = new Date(meetingDate1); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16); })() : ""}
                            onChange={(e) => setMeetingDate1(e.target.value ? new Date(e.target.value).toISOString() : "")}
                            disabled={loading}
                          />
                          {bookingLinks[0] && (
                            <a href={bookingLinks[0]} target="_blank" rel="noopener noreferrer" className={styles.bookingLink}>
                              🔗
                            </a>
                          )}
                        </div>
                        <div className={styles.datePickerItem}>
                          <label>Slot 2:</label>
                          <input
                            type="datetime-local"
                            className={styles.inlineEditable}
                            value={meetingDate2 ? (() => { const d = new Date(meetingDate2); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16); })() : ""}
                            onChange={(e) => setMeetingDate2(e.target.value ? new Date(e.target.value).toISOString() : "")}
                            disabled={loading}
                          />
                          {bookingLinks[1] && (
                            <a href={bookingLinks[1]} target="_blank" rel="noopener noreferrer" className={styles.bookingLink}>
                              🔗
                            </a>
                          )}
                        </div>
                        <div className={styles.datePickerItem}>
                          <label>Slot 3:</label>
                          <input
                            type="datetime-local"
                            className={styles.inlineEditable}
                            value={meetingDate3 ? (() => { const d = new Date(meetingDate3); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16); })() : ""}
                            onChange={(e) => setMeetingDate3(e.target.value ? new Date(e.target.value).toISOString() : "")}
                            disabled={loading}
                          />
                          {bookingLinks[2] && (
                            <a href={bookingLinks[2]} target="_blank" rel="noopener noreferrer" className={styles.bookingLink}>
                              🔗
                            </a>
                          )}
                        </div>
                      </div>
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
            />

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
                        console.error("Failed to save emailSent flag:", error);
                      }
                    }
                  }}
                />
                <span>Mark email as sent</span>
              </label>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Lead Status</label>
              <select
                className={styles.select}
                value={leadStatus}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  setLeadStatus(newStatus);

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
                  Visit Presentation
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
                Search LinkedIn
              </Button>
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

                  {runningAutomation && automationProgress && (
                    <div className={styles.progressMessage}>
                      {automationProgress}
                    </div>
                  )}

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
