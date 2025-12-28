import express from "express";
import { generateController } from "../controllers/generateController";

const router = express.Router();

router.post("/", (req, res) => generateController.getScreenshots(req, res));

export default router;
