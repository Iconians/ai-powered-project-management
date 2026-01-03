import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import crypto from "crypto";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    if (!GITHUB_CLIENT_ID) {
      return NextResponse.json(
        { error: "GitHub OAuth not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    const state = boardId || crypto.randomBytes(16).toString("hex");

    // Normalize NEXTAUTH_URL to remove trailing slash
    const baseUrl = NEXTAUTH_URL.replace(/\/$/, "");
    const callbackUrl = `${baseUrl}/api/github/callback`;
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&scope=repo,read:org&state=${state}`;

    // Debug logging
    console.log("GitHub OAuth redirect:", {
      NEXTAUTH_URL,
      baseUrl,
      callbackUrl,
      redirectUri: encodeURIComponent(callbackUrl),
    });

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initiate GitHub OAuth";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
