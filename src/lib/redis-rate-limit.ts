/**
 * Redis-based rate limiting for production
 * Falls back to in-memory rate limiting if Redis is not available
 *
 * To use Redis rate limiting:
 * 1. Install redis: bun add redis
 * 2. Set REDIS_URL environment variable
 */

import { rateLimit } from "./rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Check if Redis is available
let redisClient: any = null;
let redisAvailable = false;
let redisInitialized = false;

async function initRedis() {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    return null;
  }

  try {
    // Dynamically import Redis client (only if REDIS_URL is set)
    // Note: redis package is optional - install with: bun add redis
    // Use eval to prevent TypeScript from checking the import at compile time
    let redisModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      redisModule = await new Function('return import("redis")')();
    } catch (importError) {
      // Redis package not installed - this is fine, we'll use in-memory
      return null;
    }

    if (!redisModule || !redisModule.createClient) {
      return null;
    }

    const { createClient } = redisModule;
    redisClient = createClient({
      url: REDIS_URL,
    });

    redisClient.on("error", (err: Error) => {
      console.error("Redis Client Error:", err);
      redisAvailable = false;
    });

    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch (error) {
    console.warn(
      "⚠️ Redis not available, falling back to in-memory rate limiting:",
      error
    );
    redisAvailable = false;
    return null;
  }
}

/**
 * Redis-based rate limiting
 * Uses Redis for distributed rate limiting across multiple instances
 */
export async function redisRateLimit(
  req: NextRequest,
  config: {
    limit: number;
    window: number;
    identifier?: (req: NextRequest) => string;
  }
) {
  // Initialize Redis if not already done
  if (!redisClient && process.env.REDIS_URL) {
    await initRedis();
  }

  // Fall back to in-memory rate limiting if Redis is not available
  if (!redisAvailable || !redisClient) {
    return rateLimit(req, config);
  }

  // Get identifier
  const identifier =
    config.identifier?.(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `rate_limit:${identifier}:${config.window}`;
  const now = Date.now();
  const windowMs = config.window * 1000;

  try {
    // Use Redis INCR with expiration
    const count = await redisClient.incr(key);

    // Set expiration on first request
    if (count === 1) {
      await redisClient.expire(key, config.window);
    }

    // Check if rate limit exceeded
    if (count > config.limit) {
      const ttl = await redisClient.ttl(key);
      const retryAfter = ttl > 0 ? ttl : config.window;

      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(now + windowMs).toISOString(),
          },
        }
      );
    }

    // Not rate limited - return null to continue
    return null;
  } catch (error) {
    console.error("Redis rate limit error:", error);
    // Fall back to in-memory rate limiting on error
    return rateLimit(req, config);
  }
}

/**
 * Pre-configured Redis rate limiters
 * Automatically falls back to in-memory if Redis is not available
 */
export const redisRateLimiters = {
  login: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 5,
      window: 15 * 60, // 15 minutes
    }),

  signup: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  passwordReset: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  forgotPassword: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  api: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 100,
      window: 60, // 1 minute
    }),
};
