import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logSecurityEvent } from "@/lib/security-logger";




let loginAttempts = new Map<string, { count: number; resetTime: number }>();


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
  const window = 15 * 60 * 1000; 
  const limit = 5;

  let entry = loginAttempts.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + window };
    loginAttempts.set(key, entry);
    return true; 
  }

  entry.count++;
  loginAttempts.set(key, entry);

  if (entry.count > limit) {
    return false; 
  }

  return true; 
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

          
          if (!checkLoginRateLimit(credentials.email)) {
            console.error("Rate limit exceeded for:", credentials.email);
            throw new Error(
              "Too many login attempts. Please try again in 15 minutes."
            );
          }

          
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(credentials.email)) {
            throw new Error("Invalid email format");
          }

          
          if (credentials.password.length < 12) {
            throw new Error("Password must be at least 12 characters");
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.error("User not found:", credentials.email);
            
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

          
          if (!user.emailVerified) {
            console.error("❌ Email not verified for user:", credentials.email);
            
            
            return null; 
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("❌ Authorization error:", error);
          
          if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          }
          
          
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
