import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logSecurityEvent } from "@/lib/security-logger";

// Rate limiting wrapper for NextAuth authorize function
// Note: This is a workaround since NextAuth doesn't directly support rate limiting
// In production, consider using middleware or a reverse proxy for rate limiting
let loginAttempts = new Map<string, { count: number; resetTime: number }>();

// Clean up login attempts every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (entry.resetTime < now) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkLoginRateLimit(email: string): boolean {
  const key = `login:${email}`;
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 minutes
  const limit = 5;

  let entry = loginAttempts.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + window };
    loginAttempts.set(key, entry);
    return true; // Allowed
  }

  entry.count++;
  loginAttempts.set(key, entry);

  if (entry.count > limit) {
    return false; // Rate limited
  }

  return true; // Allowed
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error("Missing credentials");
            throw new Error("Email and password are required");
          }

          // Rate limiting for login attempts
          if (!checkLoginRateLimit(credentials.email)) {
            console.error("Rate limit exceeded for:", credentials.email);
            throw new Error(
              "Too many login attempts. Please try again in 15 minutes."
            );
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(credentials.email)) {
            throw new Error("Invalid email format");
          }

          // Validate password length
          if (credentials.password.length < 12) {
            throw new Error("Password must be at least 12 characters");
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.error("User not found:", credentials.email);
            // Log authentication failure
            logSecurityEvent(
              "auth_failure",
              "/api/auth/login",
              credentials.email,
              {
                reason: "user_not_found",
              }
            );
            throw new Error("Invalid email or password");
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            console.error("Invalid password for user:", credentials.email);
            // Log authentication failure
            logSecurityEvent(
              "auth_failure",
              "/api/auth/login",
              credentials.email,
              {
                reason: "invalid_password",
              }
            );
            throw new Error("Invalid email or password");
          }

          // Check if email is verified
          if (!user.emailVerified) {
            console.error("❌ Email not verified for user:", credentials.email);
            // For email verification errors, we need to return null but log the specific reason
            // NextAuth doesn't easily pass custom error messages, so we'll handle this in the login page
            return null; // This will trigger CredentialsSignin, but we'll check emailVerified in a custom endpoint
          }

          console.log("✅ User authenticated successfully:", credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("❌ Authorization error:", error);
          // Log the specific error for debugging
          if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          }
          // Return null to indicate authentication failure
          // NextAuth will convert this to a CredentialsSignin error
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `${
        process.env.NODE_ENV === "production" ? "__Secure-" : ""
      }next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  debug: process.env.NODE_ENV === "development",
};
