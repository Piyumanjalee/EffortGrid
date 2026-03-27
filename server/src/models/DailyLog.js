import mongoose from "mongoose";

const rowSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    cells: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  { _id: true }
);

const dailyLogSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    intervalMinutes: {
      type: Number,
      required: true,
      default: 15,
    },
    startTime: {
      type: String,
      required: true,
      default: "08:00",
    },
    endTime: {
      type: String,
      required: true,
      default: "10:00",
    },
    rows: {
      type: [rowSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("DailyLog", dailyLogSchema);
