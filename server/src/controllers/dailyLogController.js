import DailyLog from "../models/DailyLog.js";
import mongoose from "mongoose";

const DEFAULT_DATA = {
  key: "default",
  intervalMinutes: 15,
  startTime: "08:00",
  endTime: "10:00",
  rows: [
    { date: "2026/3/27", units: Array.from({ length: 15 }, () => false) },
    { date: "2026/3/28", units: Array.from({ length: 15 }, () => false) },
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

const normalizeUnits = (units, fallbackCount = 15) => {
  const safeCount = Number.isFinite(fallbackCount) && fallbackCount > 0 ? Math.floor(fallbackCount) : 15;
  return Array.from({ length: safeCount }, (_value, index) => toBoolean(units?.[index]));
};

const normalizeRow = (row = {}, intervalMinutes = 15) => {
  const unitsPerSlot = Math.max(1, Math.floor(Number(intervalMinutes) / 15));
  const fallbackCountFromCells = row?.cells && typeof row.cells === "object" ? Object.keys(row.cells).length * unitsPerSlot : 15;

  let normalizedUnits = [];
  if (Array.isArray(row?.units)) {
    normalizedUnits = normalizeUnits(row.units, row.units.length || fallbackCountFromCells);
  } else if (row?.cells && typeof row.cells === "object") {
    const legacyValues = Object.values(row.cells).map((value) => toBoolean(value));
    const expandedLegacyUnits = legacyValues.flatMap((value) => Array.from({ length: unitsPerSlot }, () => value));
    normalizedUnits = normalizeUnits(expandedLegacyUnits, expandedLegacyUnits.length || fallbackCountFromCells);
  } else {
    normalizedUnits = normalizeUnits([], fallbackCountFromCells);
  }

  const normalized = {
    date: String(row?.date ?? "").trim(),
    units: normalizedUnits,
  };

  if (row?._id && mongoose.Types.ObjectId.isValid(row._id)) {
    normalized._id = row._id;
  }

  return normalized;
};

let memoryDailyLog = {
  ...DEFAULT_DATA,
  rows: DEFAULT_DATA.rows.map((row) => ({ ...row, units: Array.isArray(row.units) ? [...row.units] : [] })),
};
memoryDailyLog = {
  ...memoryDailyLog,
  rows: (memoryDailyLog.rows ?? []).map((row) => normalizeRow(row, memoryDailyLog.intervalMinutes)),
};

const cloneDailyLog = (data) => ({
  key: "default",
  intervalMinutes: data.intervalMinutes,
  startTime: data.startTime,
  endTime: data.endTime,
  rows: (data.rows ?? []).map((row) => normalizeRow(row, data.intervalMinutes)),
});

// Legacy dashboard routes use a different shape than the new per-user DailyLog schema.
// Keep these endpoints in memory mode for backward compatibility with the current frontend.
const isDatabaseReady = () => false;

const sanitizePayload = (payload = {}) => {
  const intervalMinutes = Number(payload.intervalMinutes);
  const safeInterval = Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 15;
  const normalizedRows = Array.isArray(payload.rows)
    ? payload.rows.map((row) => normalizeRow(row, safeInterval))
    : [];

  return {
    key: "default",
    intervalMinutes: safeInterval,
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

const findDeleteIndex = (rows = [], { rowId, rowIndex, date }) => {
  if (rowId) {
    const byId = rows.findIndex((row) => String(row?._id ?? "") === String(rowId));
    if (byId >= 0) {
      return byId;
    }
  }

  const indexValue = Number(rowIndex);
  if (Number.isInteger(indexValue) && indexValue >= 0 && indexValue < rows.length) {
    return indexValue;
  }

  if (date) {
    const byDate = rows.findIndex((row) => String(row?.date ?? "") === String(date));
    if (byDate >= 0) {
      return byDate;
    }
  }

  return -1;
};

export const deleteDailyLogRow = async (req, res, next) => {
  try {
    const { rowId, rowIndex, date } = req.body ?? {};

    if (!isDatabaseReady()) {
      const memoryRows = [...(memoryDailyLog.rows ?? [])];
      const deleteIndex = findDeleteIndex(memoryRows, { rowId, rowIndex, date });

      if (deleteIndex < 0) {
        res.status(404).json({ message: "Row not found" });
        return;
      }

      memoryRows.splice(deleteIndex, 1);
      memoryDailyLog = {
        ...memoryDailyLog,
        rows: memoryRows,
      };

      res.status(200).json({
        message: "Row deleted in memory mode",
        data: cloneDailyLog(memoryDailyLog),
      });
      return;
    }

    const doc = await DailyLog.findOne({ key: "default" });

    if (!doc) {
      res.status(404).json({ message: "Daily Log not found" });
      return;
    }

    const rows = doc.rows ?? [];
    const deleteIndex = findDeleteIndex(rows, { rowId, rowIndex, date });

    if (deleteIndex < 0) {
      res.status(404).json({ message: "Row not found" });
      return;
    }

    rows.splice(deleteIndex, 1);
    doc.rows = rows;
    await doc.save();

    res.status(200).json({
      message: "Row deleted successfully",
      data: doc.toObject(),
    });
  } catch (error) {
    next(error);
  }
};
