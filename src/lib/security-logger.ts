interface SecurityEvent {
  type: string;
  path: string;
  identifier: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export function logSecurityEvent(
  type: string,
  path: string,
  identifier: string,
  metadata?: Record<string, unknown>
) {
  const event: SecurityEvent = {
    type,
    path,
    identifier,
    metadata,
    timestamp: new Date(),
  };

  if (process.env.NODE_ENV === "development") {
    console.warn("[Security Event]", event);
    return;
  }

  console.warn("[Security Event]", JSON.stringify(event));
}

export function logAuthFailure(
  email: string,
  reason: string,
  metadata?: Record<string, unknown>
) {
  logSecurityEvent("auth_failure", "/api/auth/callback/credentials", email, {
    reason,
    ...metadata,
  });
}

export function logSuspiciousActivity(
  path: string,
  identifier: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  logSecurityEvent("suspicious_activity", path, identifier, {
    description,
    ...metadata,
  });
}
