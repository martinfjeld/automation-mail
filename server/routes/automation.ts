import { Router } from "express";
import { automationController } from "../controllers/automationController";

const router = Router();

// Run automation
router.post("/run", (req, res) => automationController.runAutomation(req, res));

export default router;
