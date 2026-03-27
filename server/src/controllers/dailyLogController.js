import DailyLog from "../models/DailyLog.js";
import mongoose from "mongoose";

const DEFAULT_DATA = {
  key: "default",
  intervalMinutes: 15,
  startTime: "08:00",
  endTime: "10:00",
  rows: [
    { date: "2026/3/27", cells: {} },
    { date: "2026/3/28", cells: {} },
  ],
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }

  return false;
};

const normalizeCells = (cells) => {
  if (!cells || typeof cells !== "object") {
    return {};
  }

  return Object.entries(cells).reduce((accumulator, [slot, value]) => {
    accumulator[slot] = toBoolean(value);
    return accumulator;
  }, {});
};

let memoryDailyLog = { ...DEFAULT_DATA, rows: DEFAULT_DATA.rows.map((row) => ({ ...row, cells: { ...row.cells } })) };

const cloneDailyLog = (data) => ({
  key: "default",
  intervalMinutes: data.intervalMinutes,
  startTime: data.startTime,
  endTime: data.endTime,
  rows: (data.rows ?? []).map((row) => ({
    date: String(row?.date ?? ""),
    cells: normalizeCells(row?.cells),
  })),
});

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const sanitizePayload = (payload = {}) => {
  const intervalMinutes = Number(payload.intervalMinutes);
  const normalizedRows = Array.isArray(payload.rows)
    ? payload.rows.map((row) => ({
        date: String(row?.date ?? "").trim(),
        cells: normalizeCells(row?.cells),
      }))
    : [];

  return {
    key: "default",
    intervalMinutes: Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 15,
    startTime: String(payload.startTime ?? "08:00"),
    endTime: String(payload.endTime ?? "10:00"),
    rows: normalizedRows,
  };
};

export const getDailyLog = async (_req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      res.status(200).json(cloneDailyLog(memoryDailyLog));
      return;
    }

    let doc = await DailyLog.findOne({ key: "default" }).lean();

    if (!doc) {
      doc = await DailyLog.create(DEFAULT_DATA);
      doc = doc.toObject();
    }

    res.status(200).json(doc);
  } catch (error) {
    next(error);
  }
};

export const saveDailyLog = async (req, res, next) => {
  try {
    const sanitized = sanitizePayload(req.body);

    if (!isDatabaseReady()) {
      memoryDailyLog = cloneDailyLog(sanitized);
      res.status(200).json({
        message: "Daily Log saved in memory (MongoDB unavailable)",
        data: cloneDailyLog(memoryDailyLog),
      });
      return;
    }

    const updated = await DailyLog.findOneAndUpdate(
      { key: "default" },
      { $set: sanitized },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    ).lean();

    res.status(200).json({ message: "Daily Log saved successfully", data: updated });
  } catch (error) {
    next(error);
  }
};
