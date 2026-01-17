import { Router, Request, Response } from "express";
import { confirmBooking } from "../controllers/bookingController";
import { HistoryService } from "../services/historyService";
import axios from "axios";

const router = Router();

/**
 * POST /api/booking/confirm
 * Receive booking confirmation from the booking app
 * Body: { bookingToken, email, name, meetingStartISO, meetingEndISO, shortCode }
 */
router.post("/confirm", confirmBooking);

/**
 * POST /api/booking/regenerate
 * Regenerate booking links for a single entry when email changes
 * Body: { notionPageId, customerEmail, customerName? }
 */
router.post("/regenerate", async (req: Request, res: Response) => {
  try {
    const { notionPageId, customerEmail, customerName } = req.body;

    if (!notionPageId || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: "notionPageId and customerEmail are required",
      });
    }

    const historyService = new HistoryService();
    const entry = historyService.getEntryByNotionPageId(notionPageId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "Entry not found",
      });
    }

    if (!entry.meetingDates || entry.meetingDates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Entry has no meeting dates",
      });
    }

    const baseUrl = process.env.BASE_URL || "https://www.no-offence.io";
    const backendUrl =
      process.env.BACKEND_URL || "https://automation-mail-zk8t.onrender.com";

    // Create new booking tokens with updated customer email
    const encodedEmail = encodeURIComponent(customerEmail);
    const encodedName = encodeURIComponent(customerName || "");

    const bookingLinksPromises = entry.meetingDates.map(async (meetingISO) => {
      const startDate = new Date(meetingISO);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      const tokenData = `${startMs}|${endMs}|${customerEmail}`;
      const bookingToken = Buffer.from(tokenData).toString("base64url");

      const bookingUrl = `${baseUrl}/book/${bookingToken}?e=${encodedEmail}&n=${encodedName}`;

      // Try to create short URL
      try {
        const response = await axios.post(
          `${backendUrl}/api/short-urls`,
          { fullUrl: bookingUrl },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 5000,
          }
        );

        if (response.status === 200 || response.status === 201) {
          return response.data.shortUrl;
        }
        return bookingUrl;
      } catch (error) {
        console.warn("Failed to create short URL, using full URL");
        return bookingUrl;
      }
    });

    const newBookingLinks = await Promise.all(bookingLinksPromises);

    // Format meeting displays
    const formatMeetingDisplay = (isoString: string): string => {
      const date = new Date(isoString);
      const endDate = new Date(date.getTime() + 30 * 60 * 1000);

      const days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
      const months = [
        "jan",
        "feb",
        "mar",
        "apr",
        "mai",
        "jun",
        "jul",
        "aug",
        "sep",
        "okt",
        "nov",
        "des",
      ];

      const dayName = days[date.getDay()];
      const day = date.getDate();
      const month = months[date.getMonth()];

      const startTime = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
      ).padStart(2, "0")}`;
      const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(
        endDate.getMinutes()
      ).padStart(2, "0")}`;

      return `${dayName} ${day}. ${month}, ${startTime}–${endTime}`;
    };

    // Update email content with new booking links
    let updatedEmailContent = entry.emailContent || "";

    // Remove old meeting section
    const meetingRegex =
      /\n\nHer har du tre forslag til møter.*?\n\nMed vennlig hilsen,/s;
    if (meetingRegex.test(updatedEmailContent)) {
      updatedEmailContent = updatedEmailContent.replace(
        meetingRegex,
        "\n\nMed vennlig hilsen,"
      );
    }

    // Create new meeting block
    const meetingBlock =
      `\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n` +
      entry.meetingDates
        .map((meetingISO, index) => {
          const display = formatMeetingDisplay(meetingISO);
          return `${index + 1}. ${display} - ${newBookingLinks[index]}`;
        })
        .join("\n\n");

    // Insert before "Med vennlig hilsen,"
    if (updatedEmailContent.includes("Med vennlig hilsen,")) {
      updatedEmailContent = updatedEmailContent.replace(
        "Med vennlig hilsen,",
        `${meetingBlock}\n\nMed vennlig hilsen,`
      );
    } else {
      updatedEmailContent += meetingBlock + "\n\nMed vennlig hilsen,";
    }

    // Update the entry
    historyService.updateEntry(entry.id, {
      bookingLinks: newBookingLinks,
      emailContent: updatedEmailContent,
      email: customerEmail,
    });

    res.json({
      success: true,
      bookingLinks: newBookingLinks,
      emailContent: updatedEmailContent,
    });
  } catch (error: any) {
    console.error("Error regenerating booking links:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to regenerate booking links",
    });
  }
});

export default router;
