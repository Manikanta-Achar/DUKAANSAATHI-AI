import express from "express";
import {
  processVoice,
  executeVoiceAction,
} from "../controllers/voiceController.js";

const router = express.Router();

router.post("/process", processVoice);
router.post("/execute", executeVoiceAction);

export default router;
