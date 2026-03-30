import DailyLog from "../models/DailyLog.js";

const normalizeDateOnly = (value) => {
  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) {
    return null;
  }

  return new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
};

const sanitizeSlots = (slots, slotCount) => {
  const safeCount = Number.isFinite(slotCount) && slotCount > 0 ? Math.floor(slotCount) : 15;
  const source = Array.isArray(slots) ? slots : [];

  return Array.from({ length: safeCount }, (_value, index) => Boolean(source[index]));
};

export const getLogs = async (req, res, next) => {
  try {
    const logs = await DailyLog.find({ user: req.user._id }).sort({ date: 1 }).lean();
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

export const upsertLog = async (req, res, next) => {
  try {
    const { date, slots, interval, slotCount } = req.body ?? {};

    if (!date) {
      res.status(400).json({ message: "Date is required" });
      return;
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      res.status(400).json({ message: "Invalid date" });
      return;
    }

    const safeSlotCount = Number.isFinite(Number(slotCount)) && Number(slotCount) > 0 ? Math.floor(Number(slotCount)) : 15;
    const safeInterval = Number.isFinite(Number(interval)) && Number(interval) > 0 ? Math.floor(Number(interval)) : 15;
    const normalizedSlots = sanitizeSlots(slots, safeSlotCount);

    const log = await DailyLog.findOneAndUpdate(
      {
        user: req.user._id,
        date: normalizedDate,
      },
      {
        $set: {
          slots: normalizedSlots,
          interval: safeInterval,
          slotCount: safeSlotCount,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    res.status(200).json(log);
  } catch (error) {
    next(error);
  }
};

export const deleteLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await DailyLog.findOneAndDelete({
      _id: id,
      user: req.user._id,
    }).lean();

    if (!deleted) {
      res.status(404).json({ message: "Log not found" });
      return;
    }

    res.status(200).json({ message: "Log deleted" });
  } catch (error) {
    next(error);
  }
};
