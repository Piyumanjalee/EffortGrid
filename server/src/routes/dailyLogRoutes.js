import { Router } from "express";
import { getDailyLog, saveDailyLog } from "../controllers/dailyLogController.js";

const router = Router();

router.get("/daily-log", getDailyLog);
router.post("/daily-log/save", saveDailyLog);

export default router;
