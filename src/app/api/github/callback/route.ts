import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/github";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
// Normalize NEXTAUTH_URL to remove trailing slash
const NEXTAUTH_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
          "No authorization code received"
        )}`
      );
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
          "GitHub OAuth not configured"
        )}`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
          tokenData.error_description || tokenData.error
        )}`
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(
        `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
          "Failed to get access token"
        )}`
      );
    }

    // Get user's GitHub info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    const githubUser = await userResponse.json();

    // Update the current user's GitHub username
    const currentUser = await getCurrentUser();
    if (currentUser?.email) {
      try {
        await prisma.user.update({
          where: { email: currentUser.email },
          data: {
            githubUsername: githubUser.login,
          },
        });
        console.log(`✅ Updated GitHub username for user ${currentUser.email}: ${githubUser.login}`);
      } catch (error) {
        console.error("Failed to update GitHub username:", error);
        // Don't fail the OAuth flow if this fails
      }
    }

    // If state is a boardId, update that board
    if (state && state.length > 10) {
      // Likely a boardId (cuid format)
      try {
        await requireBoardAccess(state);
        const encryptedToken = encryptToken(accessToken);

        // Get the board to check if we need to set the repo name
        const board = await prisma.board.findUnique({
          where: { id: state },
        });

        // If no repo name is set, try to get it from the board name or prompt user
        // For now, we'll require the user to set it manually or via a separate endpoint
        await prisma.board.update({
          where: { id: state },
          data: {
            githubAccessToken: encryptedToken,
            githubSyncEnabled: true,
            // githubRepoName will be set separately via UI or API
          },
        });

        return NextResponse.redirect(
          `${NEXTAUTH_URL}/boards/${state}?github=connected`
        );
      } catch (error) {
        // If board access fails, just redirect to boards
        return NextResponse.redirect(
          `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
            "Failed to connect GitHub"
          )}`
        );
      }
    }

    // Otherwise, just redirect to boards
    return NextResponse.redirect(`${NEXTAUTH_URL}/boards?github=connected`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to complete GitHub OAuth";
    return NextResponse.redirect(
      `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(message)}`
    );
  }
}
