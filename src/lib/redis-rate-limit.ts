import { rateLimit } from "./rate-limit";
import { NextRequest, NextResponse } from "next/server";

type RedisClient = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: (err: Error) => void) => void;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
  ttl: (key: string) => Promise<number>;
};

let redisClient: RedisClient | null = null;
let redisAvailable = false;
let redisInitialized = false;

async function initRedis(): Promise<RedisClient | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    return null;
  }

  try {
    let redisModule: {
      createClient: (options: { url: string }) => RedisClient;
    } | null = null;
    try {
      redisModule = await new Function('return import("redis")')();
    } catch (importError) {
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

export async function redisRateLimit(
  req: NextRequest,
  config: {
    limit: number;
    window: number;
    identifier?: (req: NextRequest) => string;
  }
) {
  if (!redisClient && process.env.REDIS_URL) {
    await initRedis();
  }

  if (!redisAvailable || !redisClient) {
    return rateLimit(req, config);
  }

  const identifier =
    config.identifier?.(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `rate_limit:${identifier}:${config.window}`;
  const now = Date.now();
  const windowMs = config.window * 1000;

  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, config.window);
    }
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
    return null;
  } catch (error) {
    console.error("Redis rate limit error:", error);
    return rateLimit(req, config);
  }
}

export const redisRateLimiters = {
  login: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 5,
      window: 15 * 60,
    }),

  signup: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  passwordReset: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  forgotPassword: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  api: (req: NextRequest) =>
    redisRateLimit(req, {
      limit: 100,
      window: 60,
    }),
};
