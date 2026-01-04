import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "./security-logger";

// In-memory rate limit store (for development/single-instance)
// In production with multiple instances, use Redis
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  limit: number; // Maximum number of requests
  window: number; // Time window in seconds
  identifier?: (req: NextRequest) => string; // Custom identifier function
}

/**
 * Rate limiting middleware
 * @param config Rate limit configuration
 * @returns Middleware function that returns NextResponse if rate limited, null otherwise
 */
export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  // Get identifier (IP address by default)
  const identifier =
    config.identifier?.(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `${identifier}:${config.window}`;
  const now = Date.now();
  const resetTime = now + config.window * 1000;

  // Get or create entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = { count: 1, resetTime };
    rateLimitStore.set(key, entry);
    return null; // Not rate limited
  }

  // Increment count
  entry.count++;

  if (entry.count > config.limit) {
    // Rate limited - log security event
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

  // Update entry
  rateLimitStore.set(key, entry);

  // Return null to continue
  return null;
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Login: 5 attempts per 15 minutes
  login: (req: NextRequest) =>
    rateLimit(req, {
      limit: 5,
      window: 15 * 60, // 15 minutes
    }),

  // Signup: 3 attempts per hour
  signup: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  // Password reset: 3 attempts per hour
  passwordReset: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  // Forgot password: 3 attempts per hour
  forgotPassword: (req: NextRequest) =>
    rateLimit(req, {
      limit: 3,
      window: 60 * 60, // 1 hour
    }),

  // General API: 100 requests per minute
  api: (req: NextRequest) =>
    rateLimit(req, {
      limit: 100,
      window: 60, // 1 minute
    }),
};
