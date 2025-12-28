import { Router, Request, Response } from "express";
import { setupController } from "../controllers/setupController";
import { setupRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Apply rate limiting to setup endpoints
router.use(setupRateLimiter);

// Check setup status
router.get("/status", setupController.checkStatus);

// Validate and save keys
router.post("/validate", setupController.validateAndSave);

export default router;
