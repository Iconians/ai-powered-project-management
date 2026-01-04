/**
 * Security logging utility for tracking authentication failures and suspicious activities
 */

interface SecurityLogEntry {
  type: "auth_failure" | "rate_limit" | "suspicious_activity";
  endpoint: string;
  identifier: string; // IP, email, or user ID
  details: Record<string, unknown>;
  timestamp: Date;
}

// In-memory log store (in production, use a proper logging service)
const securityLogs: SecurityLogEntry[] = [];
const MAX_LOGS = 1000; // Keep last 1000 entries

/**
 * Log security events
 */
export function logSecurityEvent(
  type: SecurityLogEntry["type"],
  endpoint: string,
  identifier: string,
  details: Record<string, unknown> = {}
): void {
  const entry: SecurityLogEntry = {
    type,
    endpoint,
    identifier,
    details,
    timestamp: new Date(),
  };

  securityLogs.push(entry);

  // Keep only last MAX_LOGS entries
  if (securityLogs.length > MAX_LOGS) {
    securityLogs.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[SECURITY] ${type.toUpperCase()}:`, {
      endpoint,
      identifier,
      details,
      timestamp: entry.timestamp.toISOString(),
    });
  }

  // In production, send to logging service (e.g., Sentry, LogRocket, etc.)
  if (process.env.NODE_ENV === "production") {
    // TODO: Integrate with your logging service
    // Example: Sentry.captureMessage(`Security event: ${type}`, { extra: entry });
  }
}

/**
 * Get recent security logs (for monitoring/admin dashboard)
 */
export function getRecentSecurityLogs(
  limit: number = 100,
  type?: SecurityLogEntry["type"]
): SecurityLogEntry[] {
  let logs = [...securityLogs].reverse(); // Most recent first

  if (type) {
    logs = logs.filter((log) => log.type === type);
  }

  return logs.slice(0, limit);
}

/**
 * Check for suspicious patterns
 */
export function detectSuspiciousActivity(identifier: string): boolean {
  const recentLogs = securityLogs.filter(
    (log) =>
      log.identifier === identifier &&
      log.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
  );

  // Multiple auth failures in short time
  const authFailures = recentLogs.filter(
    (log) => log.type === "auth_failure"
  ).length;

  // Multiple rate limit hits
  const rateLimitHits = recentLogs.filter(
    (log) => log.type === "rate_limit"
  ).length;

  // Consider suspicious if:
  // - More than 10 auth failures in an hour
  // - More than 5 rate limit hits in an hour
  return authFailures > 10 || rateLimitHits > 5;
}
