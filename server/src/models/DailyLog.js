import mongoose from "mongoose";

const dailyLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    slots: {
      type: [Boolean],
      default: [],
    },
    interval: {
      type: Number,
      required: true,
      default: 15,
    },
    slotCount: {
      type: Number,
      required: true,
      default: 15,
    },
  },
  { timestamps: true }
);

dailyLogSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyLog", dailyLogSchema);
