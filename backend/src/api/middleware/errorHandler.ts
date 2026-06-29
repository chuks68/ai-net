import type { Request, Response, NextFunction } from "express";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(
    {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      requestId: res.locals.requestId,
    },
    "unhandled error",
  );

  res.status(500).json({
    error: {
      message: err.message || "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
}
