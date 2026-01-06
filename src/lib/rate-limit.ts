import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "./security-logger";

import "./env-validation";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  limit: number;
  window: number;
  identifier?: (req: NextRequest) => string;
}

export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const identifier =
    config.identifier?.(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `${identifier}:${config.window}`;
  const now = Date.now();
  const resetTime = now + config.window * 1000;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime };
    rateLimitStore.set(key, entry);
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const url = new URL(req.url);
    logSecurityEvent("rate_limit", url.pathname, identifier, {
      limit: config.limit,
      window: config.window,
    });

    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
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
          "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
        },
      }
    );
  }

  rateLimitStore.set(key, entry);

  return null;
}

export const rateLimiters = {
  login: (req: NextRequest) =>
    rateLimit(req, {
      limit: 5,
      window: 15 * 60,
    }),

  signup: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  passwordReset: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  forgotPassword: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60,
    }),

  api: (req: NextRequest) =>
    rateLimit(req, {
      limit: 100,
      window: 60,
    }),
};
