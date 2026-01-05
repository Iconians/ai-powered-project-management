/**
 * Security event logger
 * In production, this should integrate with your logging service (e.g., Sentry, LogRocket, etc.)
 */

interface SecurityEvent {
  type: string;
  path: string;
  identifier: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Log security events for monitoring and alerting
 */
export function logSecurityEvent(
  type: string,
  path: string,
  identifier: string,
  metadata?: Record<string, any>
) {
  const event: SecurityEvent = {
    type,
    path,
    identifier,
    metadata,
    timestamp: new Date(),
  };

  // In development, log to console
  if (process.env.NODE_ENV === "development") {
    console.warn("[Security Event]", event);
    return;
  }

  // In production, you should:
  // 1. Send to your logging service (Sentry, LogRocket, etc.)
  // 2. Send alerts for critical events (e.g., rate limit violations, suspicious activity)
  // 3. Store in database for audit trail
  // 4. Integrate with monitoring tools

  // Example: Send to external logging service
  // if (process.env.SECURITY_WEBHOOK_URL) {
  //   fetch(process.env.SECURITY_WEBHOOK_URL, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(event),
  //   }).catch(console.error);
  // }

  // For now, log to console in production (replace with proper logging)
  console.warn("[Security Event]", JSON.stringify(event));
}

/**
 * Log authentication failures
 */
export function logAuthFailure(
  email: string,
  reason: string,
  metadata?: Record<string, any>
) {
  logSecurityEvent("auth_failure", "/api/auth/callback/credentials", email, {
    reason,
    ...metadata,
  });
}

/**
 * Log suspicious activity
 */
export function logSuspiciousActivity(
  path: string,
  identifier: string,
  description: string,
  metadata?: Record<string, any>
) {
  logSecurityEvent("suspicious_activity", path, identifier, {
    description,
    ...metadata,
  });
}
