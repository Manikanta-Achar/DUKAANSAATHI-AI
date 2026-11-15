import express from "express";
import {
  processVoice,
  executeVoiceAction,
  previewCustomerAction,
} from "../controllers/voiceController.js";

const router = express.Router();

router.post("/process", processVoice);
router.post('/preview', previewCustomerAction);
router.post("/execute", executeVoiceAction);

export default router;
