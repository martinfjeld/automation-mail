import { Router } from "express";
import filesController from "../controllers/filesController";

const router = Router();

router.post("/upload-generated", filesController.uploadGeneratedFiles);

export default router;
