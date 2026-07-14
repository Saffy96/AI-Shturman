import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { fuelRouter } from "./routes/fuel.routes.js";
import { geoRouter } from "./routes/geo.routes.js";

export const app = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...env.frontendOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigin === "*" || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"]
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/fuel", fuelRouter);
app.use("/api/geo", geoRouter);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      message: "Endpoint not found"
    }
  });
});

app.use(errorMiddleware);
