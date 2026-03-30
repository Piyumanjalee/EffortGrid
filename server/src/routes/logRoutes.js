import { Router } from "express";
import { deleteLog, getLogs, upsertLog } from "../controllers/logController.js";
import protect from "../middleware/protect.js";

const router = Router();

router.use(protect);
router.get("/", getLogs);
router.post("/", upsertLog);
router.delete("/:id", deleteLog);

export default router;
