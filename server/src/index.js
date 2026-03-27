import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dailyLogRoutes from "./routes/dailyLogRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(200).json({
    ok: true,
    dbReady,
    storageMode: dbReady ? "mongodb" : "memory",
  });
});

app.use("/api", dailyLogRoutes);

app.use((err, _req, res, _next) => {
  const status = err?.status || 500;
  res.status(status).json({
    message: err?.message || "Server error",
  });
});

const startServer = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it to server/.env");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  let isConnecting = false;

  const connectWithRetry = async () => {
    if (isConnecting || mongoose.connection.readyState === 1) {
      return;
    }

    try {
      isConnecting = true;
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log("MongoDB connected");
    } catch (error) {
      console.error(`MongoDB connection failed: ${error.message}. Retrying in 5 seconds...`);
      setTimeout(connectWithRetry, 5000);
    } finally {
      isConnecting = false;
    }
  };

  connectWithRetry();
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
