import { Router, Request, Response } from "express";
import { generateController } from "../controllers/generateController";
import { generateRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Apply rate limiting
router.use(generateRateLimiter);

// Generate email endpoint
router.post("/", generateController.generate);

export default router;
