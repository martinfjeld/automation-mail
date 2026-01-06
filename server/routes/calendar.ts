import { Router, Request, Response } from "express";
import { CalendarService } from "../services/calendarService";
import { HistoryService } from "../services/historyService";
import * as fs from "fs";
import * as path from "path";

const router = Router();

// Load templates once at startup
const successTemplate = fs.readFileSync(
  path.join(__dirname, "../templates/booking-success.html"),
  "utf-8"
);
const errorTemplate = fs.readFileSync(
  path.join(__dirname, "../templates/booking-error.html"),
  "utf-8"
);

/**
 * Preview booking screen for styling (dev only)
 * GET /booking-screen
 */
router.get("/booking-screen", async (req: Request, res: Response) => {
  // Reload template on each request for live editing
  const template = fs.readFileSync(
    path.join(__dirname, "../templates/booking-success.html"),
    "utf-8"
  );

  const html = template
    .replace("{{DISPLAY_TIME}}", "Ons 8. jan, 14:00–14:30")
    .replace(/{{MEET_LINK}}/g, "https://meet.google.com/abc-defg-hij")
    .replace(
      "{{EVENT_LINK}}",
      "https://calendar.google.com/calendar/event?eid=example"
    );

  res.send(html);
});

/**
 * Book a meeting from email link
 * GET /:token?e=...&n=...
 */
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { e: customerEmail, n: customerName } = req.query;

    if (!customerEmail || typeof customerEmail !== "string") {
      return res.status(400).json({
        success: false,
        error: "Customer email is required",
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const myEmail = process.env.MY_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !myEmail) {
      return res.status(500).json({
        success: false,
        error: "Google Calendar not configured",
      });
    }

    // Decode the booking token
    const { startISO, endISO } = CalendarService.decodeBookingToken(token);

    // Create calendar service
    const calendarService = new CalendarService(
      clientId,
      clientSecret,
      refreshToken
    );

    // Book the meeting
    const customerDisplayName = (customerName as string) || customerEmail;
    const result = await calendarService.createEventWithMeet(
      `Møte med ${customerDisplayName}`,
      `Innledende møte med ${customerDisplayName} fra pitch-deck kampanje.`,
      startISO,
      endISO,
      [
        { email: myEmail }, // Testing mode: only invite yourself
        // { email: customerEmail }, // Uncomment this line for production
      ]
    );

    // Return success page with meeting details
    const html = successTemplate
      .replace("{{DISPLAY_TIME}}", result.display)
      .replace(/{{MEET_LINK}}/g, result.meetLink)
      .replace("{{EVENT_LINK}}", result.eventLink);

    res.send(html);
  } catch (error: any) {
    console.error("Booking error:", error);

    let errorMessage =
      error.message || "Det oppstod en feil. Vennligst kontakt oss direkte.";

    // Add contact message for unavailable time slots
    if (errorMessage === "Tidspunktet er ikke lenger tilgjengelig") {
      errorMessage += '<br><br>Send meg en mail på <a href="mailto:martin@no-offence.io" style="color: #0f0f0f; font-weight: bold;">martin@no-offence.io</a> så finner vi et nytt tidspunkt!';
    }

    const html = errorTemplate.replace("{{ERROR_MESSAGE}}", errorMessage);

    res.status(500).send(html);
  }
});

/**
 * API endpoint: Book a meeting (returns JSON)
 * POST /api/calendar/book
 * Body: { token, clientName, clientEmail }
 */
router.post("/book", async (req: Request, res: Response) => {
  try {
    const { token, clientName, clientEmail } = req.body;

    if (!clientEmail || !token) {
      return res.status(400).json({
        success: false,
        message: "Token and client email are required",
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const myEmail = process.env.MY_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !myEmail) {
      return res.status(500).json({
        success: false,
        message: "Google Calendar not configured",
      });
    }

    // Decode the booking token
    const { startISO, endISO } = CalendarService.decodeBookingToken(token);

    // Create calendar service
    const calendarService = new CalendarService(
      clientId,
      clientSecret,
      refreshToken
    );

    // Book the meeting
    const customerDisplayName = clientName || clientEmail;
    const result = await calendarService.createEventWithMeet(
      `Møte med ${customerDisplayName}`,
      `Innledende møte med ${customerDisplayName} fra pitch-deck kampanje.`,
      startISO,
      endISO,
      [
        { email: myEmail }, // Testing mode: only invite yourself
        // { email: clientEmail }, // Uncomment this line for production
      ]
    );

    // Return JSON response
    res.json({
      success: true,
      meetLink: result.meetLink,
      eventLink: result.eventLink,
      display: result.display,
      message: "Møte booket!",
    });
  } catch (error: any) {
    console.error("Booking error:", error);

    let errorMessage =
      error.message || "Det oppstod en feil. Vennligst prøv igjen.";

    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

export default router;
