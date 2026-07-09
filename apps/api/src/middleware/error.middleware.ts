import { GdebenzClientError } from "@ai-shturman/gdebenz-client";
import type { ErrorRequestHandler } from "express";
import { env } from "../config/env.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof GdebenzClientError) {
    console.error("[gdebenz]", error.message, {
      statusCode: error.statusCode,
      isTimeout: error.isTimeout,
      cause: error.cause
    });

    res.status(error.isTimeout ? 504 : 502).json({
      ok: false,
      error: {
        message: error.isTimeout ? "gdebenz request timed out" : "gdebenz is unavailable",
        source: "gdebenz"
      }
    });
    return;
  }

  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;

  console.error("[api]", error);

  res.status(statusCode).json({
    ok: false,
    error: {
      message: error instanceof Error ? error.message : "Internal server error",
      ...(env.nodeEnv === "development" && error instanceof Error ? { stack: error.stack } : {})
    }
  });
};
