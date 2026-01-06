import { Router } from "express";
import progressController from "../controllers/progressController";

const router = Router();

router.get("/stream", (req, res) => progressController.streamProgress(req, res));

export default router;
