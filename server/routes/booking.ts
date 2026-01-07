import { Router } from "express";
import { confirmBooking } from "../controllers/bookingController";

const router = Router();

/**
 * POST /api/booking/confirm
 * Receive booking confirmation from the booking app
 * Body: { bookingToken, email, name, meetingStartISO, meetingEndISO, shortCode }
 */
router.post("/confirm", confirmBooking);

export default router;
