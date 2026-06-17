import type { NextRequest } from "next/server";

// Simple in-memory sliding-window rate limiter. Good enough for a single-node
// deployment; swap for a Redis-backed limiter when scaling horizontally.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds until the next request is allowed
}

/**
 * @param key      unique bucket key (e.g. `login:${ip}`)
 * @param limit    max requests within the window
 * @param windowMs window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { allowed: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfter: 0 };
}

// Periodically evict empty buckets so the map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of Array.from(buckets.entries())) {
      bucket.hits = bucket.hits.filter((t) => now - t < 60 * 60 * 1000);
      if (bucket.hits.length === 0) buckets.delete(key);
    }
  }, 10 * 60 * 1000).unref?.();
}
