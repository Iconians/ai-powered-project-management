interface EnvConfig {
  required: string[];
  optional: string[];
  productionOnly: string[];
}

const envConfig: EnvConfig = {
  required: ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"],
  optional: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "PUSHER_APP_ID",
    "PUSHER_KEY",
    "PUSHER_SECRET",
    "PUSHER_CLUSTER",
    "NEXT_PUBLIC_PUSHER_KEY",
    "NEXT_PUBLIC_PUSHER_CLUSTER",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",

    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_WEBHOOK_SECRET",
    "GITHUB_ENCRYPTION_KEY",
    "AI_PROVIDER",
    "GOOGLE_GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OLLAMA_URL",
    "REDIS_URL",
  ],
  productionOnly: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ],
};

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of envConfig.required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (process.env.NODE_ENV === "production") {
    for (const key of envConfig.productionOnly) {
      if (!process.env[key]) {
        warnings.push(`${key} is recommended for production but is not set`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "production") {
    console.warn("[Env Validation] Production warnings:", warnings.join(", "));
  }

  if (
    process.env.NEXTAUTH_URL &&
    !process.env.NEXTAUTH_URL.startsWith("http")
  ) {
    throw new Error(
      "NEXTAUTH_URL must be a valid URL starting with http:// or https://"
    );
  }

  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith("postgresql://") &&
    !process.env.DATABASE_URL.startsWith("postgres://")
  ) {
    console.warn(
      "[Env Validation] DATABASE_URL should start with postgresql:// or postgres://"
    );
  }
}

if (typeof window === "undefined") {
  try {
    validateEnv();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Env Validation Error]", error);
    } else {
      throw error;
    }
  }
}
