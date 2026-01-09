import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface MeetingProposal {
  label: string;
  startISO: string;
  endISO: string;
  display: string;
  bookingToken: string;
}

export interface BookingResult {
  startISO: string;
  endISO: string;
  display: string;
  eventId: string;
  eventLink: string;
  meetLink: string;
}

export class CalendarService {
  private auth: OAuth2Client;
  private calendar: any;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.auth = new OAuth2Client({
      clientId,
      clientSecret,
    });

    this.auth.setCredentials({
      refresh_token: refreshToken,
    });

    this.calendar = google.calendar({ version: "v3", auth: this.auth });
  }

  /**
   * Get busy time intervals
   */
  async getBusy(
    timeMinISO: string,
    timeMaxISO: string,
    timezone: string = "Europe/Oslo"
  ): Promise<Array<{ start: string; end: string }>> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: timeMinISO,
          timeMax: timeMaxISO,
          timeZone: timezone,
          items: [{ id: "primary" }],
        },
      });

      const busySlots = response.data.calendars?.primary?.busy || [];
      return busySlots.map((slot: any) => ({
        start: slot.start,
        end: slot.end,
      }));
    } catch (error: any) {
      console.error("Failed to get busy times:", error.message);
      throw error;
    }
  }

  /**
   * Check if a time slot is available
   */
  async isSlotAvailable(startISO: string, endISO: string): Promise<boolean> {
    const busySlots = await this.getBusy(startISO, endISO);
    return busySlots.length === 0;
  }

  /**
   * Generate 3 meeting proposals within constraints
   */
  async generateProposals(
    earliestStartISO: string,
    latestEndISO: string,
    myEmail: string,
    takenTimes: string[] = [] // ISO strings of already-proposed times
  ): Promise<MeetingProposal[]> {
    const proposals: MeetingProposal[] = [];
    const earliestDate = new Date(earliestStartISO);
    const latestDate = new Date(latestEndISO);
    const durationMinutes = 30;

    // Get all busy slots upfront
    const busySlots = await this.getBusy(earliestStartISO, latestEndISO);

    // Convert taken times to Date objects for comparison
    const takenTimestamps = takenTimes.map((t) => new Date(t).getTime());
    console.log(`🚫 Avoiding ${takenTimestamps.length} already-proposed times`);

    let currentDate = new Date(earliestDate);
    const preferredTimes = [
      { hour: 10, minute: 0, label: "morning" }, // 10:00
      { hour: 13, minute: 0, label: "midday" }, // 13:00
      { hour: 9, minute: 30, label: "morning" }, // 09:30
      { hour: 14, minute: 0, label: "afternoon" }, // 14:00
      { hour: 11, minute: 0, label: "morning" }, // 11:00
      { hour: 15, minute: 0, label: "afternoon" }, // 15:00
    ];

    // Track which days we've used to ensure 3 different days
    const usedDays = new Set<string>();

    while (proposals.length < 3 && currentDate <= latestDate) {
      const dayOfWeek = currentDate.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      // Create day key for tracking (YYYY-MM-DD)
      const dayKey = currentDate.toISOString().split("T")[0];

      // Skip if we already have a proposal for this day
      if (usedDays.has(dayKey)) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      // Shuffle preferred times to pick random available slots
      const shuffledTimes = [...preferredTimes].sort(() => Math.random() - 0.5);

      // Try shuffled time slots for this day
      for (const timeSlot of shuffledTimes) {
        if (proposals.length >= 3) break;

        const slotStart = new Date(currentDate);
        slotStart.setHours(timeSlot.hour, timeSlot.minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

        // Check if slot is in the future and within working hours
        if (slotStart < earliestDate || slotEnd > latestDate) continue;
        if (slotStart.getHours() < 9 || slotEnd.getHours() > 16) continue;
        if (slotEnd.getHours() === 16 && slotEnd.getMinutes() > 0) continue;

        // Check if slot conflicts with busy times
        const isAvailable = !busySlots.some((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        // Check if slot conflicts with already-proposed times
        const isNotAlreadyProposed = !takenTimestamps.includes(
          slotStart.getTime()
        );

        if (isAvailable && isNotAlreadyProposed) {
          const display = this.formatDateTime(slotStart, slotEnd);
          const bookingToken = this.generateBookingToken(
            slotStart.toISOString(),
            slotEnd.toISOString(),
            myEmail
          );

          proposals.push({
            label: `Option ${proposals.length + 1}`,
            startISO: slotStart.toISOString(),
            endISO: slotEnd.toISOString(),
            display,
            bookingToken,
          });

          // Mark this day as used and move to next day
          usedDays.add(dayKey);
          break;
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    if (proposals.length < 3) {
      throw new Error(
        "Kunne ikke finne 3 ledige tidspunkter innenfor de gitte begrensningene"
      );
    }

    return proposals;
  }

  /**
   * Create a calendar event with Google Meet
   */
  async createEventWithMeet(
    title: string,
    description: string,
    startISO: string,
    endISO: string,
    attendees: Array<{ email: string }>,
    timezone: string = "Europe/Oslo"
  ): Promise<BookingResult> {
    try {
      // Re-check availability
      const isAvailable = await this.isSlotAvailable(startISO, endISO);
      if (!isAvailable) {
        throw new Error("Tidspunktet er ikke lenger tilgjengelig");
      }

      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: startISO,
          timeZone: timezone,
        },
        end: {
          dateTime: endISO,
          timeZone: timezone,
        },
        attendees: attendees,
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        sendUpdates: "all", // Send email invites to all attendees
        requestBody: event,
      });

      const createdEvent = response.data;
      const startDate = new Date(startISO);
      const endDate = new Date(endISO);

      return {
        startISO,
        endISO,
        display: this.formatDateTime(startDate, endDate),
        eventId: createdEvent.id || "",
        eventLink: createdEvent.htmlLink || "",
        meetLink:
          createdEvent.conferenceData?.entryPoints?.find(
            (ep: any) => ep.entryPointType === "video"
          )?.uri || "",
      };
    } catch (error: any) {
      console.error("Failed to create calendar event:", error.message);
      throw error;
    }
  }

  /**
   * Format date/time for display (Norwegian)
   */
  private formatDateTime(start: Date, end: Date): string {
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

    const dayName = days[start.getDay()];
    const day = start.getDate();
    const month = months[start.getMonth()];

    const startTime = `${String(start.getHours()).padStart(2, "0")}:${String(
      start.getMinutes()
    ).padStart(2, "0")}`;
    const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(
      end.getMinutes()
    ).padStart(2, "0")}`;

    return `${dayName} ${day}. ${month}, ${startTime}–${endTime}`;
  }

  /**
   * Generate a shorter booking token (compact format)
   */
  private generateBookingToken(
    startISO: string,
    endISO: string,
    myEmail: string
  ): string {
    // Create compact format: timestamp_email
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const data = `${start}|${end}|${myEmail}`;
    return Buffer.from(data).toString("base64url");
  }

  /**
   * Decode a booking token
   */
  static decodeBookingToken(token: string): {
    startISO: string;
    endISO: string;
    myEmail: string;
  } {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf-8");
      const [startMs, endMs, myEmail] = decoded.split("|");
      return {
        startISO: new Date(parseInt(startMs)).toISOString(),
        endISO: new Date(parseInt(endMs)).toISOString(),
        myEmail,
      };
    } catch (error) {
      throw new Error("Ugyldig booking-token");
    }
  }
}
