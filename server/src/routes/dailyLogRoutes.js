import { Router } from "express";
import { deleteDailyLogRow, getDailyLog, saveDailyLog } from "../controllers/dailyLogController.js";

const router = Router();

router.get("/daily-log", getDailyLog);
router.post("/daily-log/save", saveDailyLog);
router.delete("/daily-log/row", deleteDailyLogRow);

export default router;
