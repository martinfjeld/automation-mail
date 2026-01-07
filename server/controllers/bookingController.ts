import { Request, Response } from "express";
import { HistoryService, HistoryEntry } from "../services/historyService";
import { NotionService } from "../services/notionService";
import { configManager } from "../utils/configManager";

/**
 * Handle booking confirmation from the booking app
 * Called when a customer successfully books a meeting
 */
export const confirmBooking = async (req: Request, res: Response) => {
  try {
    const {
      bookingToken,
      email,
      name,
      meetingStartISO,
      meetingEndISO,
      shortCode,
    } = req.body;

    console.log("📅 Booking confirmation received:", {
      bookingToken,
      email,
      name,
      meetingStartISO,
      shortCode,
    });

    // Validate required fields
    if (!bookingToken || !email || !meetingStartISO || !shortCode) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: bookingToken, email, meetingStartISO, shortCode",
      });
    }

    // Create history service instance
    const historyService = new HistoryService();

    // Find the history entry that contains this booking link
    const allEntries = historyService.getAllEntries();
    const matchingEntry = allEntries.find((entry: HistoryEntry) =>
      entry.bookingLinks?.some((link: string) => link.includes(shortCode))
    );

    if (!matchingEntry) {
      console.warn("⚠️ No matching history entry found for shortCode:", shortCode);
      return res.status(404).json({
        success: false,
        error: "No matching history entry found",
      });
    }

    console.log("✅ Found matching history entry:", matchingEntry.id);

    // Determine which slot was booked (0, 1, or 2)
    const bookedSlotIndex = matchingEntry.bookingLinks?.findIndex((link: string) =>
      link.includes(shortCode)
    );

    if (bookedSlotIndex === undefined || bookedSlotIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Could not determine which slot was booked",
      });
    }

    console.log("📍 Booked slot index:", bookedSlotIndex);

    // Update the history entry
    historyService.updateEntry(matchingEntry.id, {
      møtedato: meetingStartISO,
      bookedSlotIndex,
      leadStatus: "Avventer svar",
    });

    console.log("✅ History updated with meeting date");

    // Update Notion if we have the page ID
    if (matchingEntry.notionPageId) {
      const config = configManager.getConfig();
      if (config.NOTION_TOKEN && config.NOTION_DATABASE_ID) {
        const notionService = new NotionService(
          config.NOTION_TOKEN,
          config.NOTION_DATABASE_ID
        );

        try {
          await notionService.updateMeetingDate(
            matchingEntry.notionPageId,
            meetingStartISO,
            true // Update lead status to "Avventer svar"
          );
          console.log("✅ Notion updated with meeting date");
        } catch (notionError: any) {
          console.error("❌ Failed to update Notion:", notionError.message);
          // Don't fail the whole request if Notion update fails
        }
      } else {
        console.log("⚠️ Notion not configured, skipping Notion update");
      }
    }

    return res.json({
      success: true,
      message: "Booking confirmed successfully",
      data: {
        historyId: matchingEntry.id,
        companyName: matchingEntry.companyName,
        contactPerson: matchingEntry.contactPerson,
        møtedato: meetingStartISO,
        bookedSlotIndex,
      },
    });
  } catch (error: any) {
    console.error("❌ Booking confirmation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process booking confirmation",
    });
  }
};
