import { Router } from "express";
import { uploadController } from "../controllers/uploadController";

const router = Router();

// Upload mockup images
router.post("/mockups", (req, res) => uploadController.uploadMockups(req, res));

// Upload logo
router.post("/logo", (req, res) => uploadController.uploadLogo(req, res));

// Delete logo
router.delete("/logo", (req, res) => uploadController.deleteLogo(req, res));

export default router;
