import type { RequestHandler } from "express";

interface RateEntry { count: number; resetsAt: number }

export function createRateLimiter(limit: number, windowMs = 60_000): RequestHandler {
  const entries = new Map<string, RateEntry>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = entries.get(key);
    const entry = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + windowMs } : current;
    entry.count += 1;
    entries.set(key, entry);
    if (entry.count > limit) {
      res.status(429).json({ ok: false, error: { message: "Too many geocoding requests" } });
      return;
    }
    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) if (value.resetsAt <= now) entries.delete(entryKey);
    }
    next();
  };
}
