import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireBoardAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/github";
import { requireGitHubIntegrationLimit } from "@/lib/limits";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const NEXTAUTH_URL = (
  process.env.NEXTAUTH_URL || "http://localhost:3000"
).replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
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

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    const githubUser = await userResponse.json();

    const currentUser = await getCurrentUser();
    if (currentUser?.email) {
      try {
        await prisma.user.update({
          where: { email: currentUser.email },
          data: {
            githubUsername: githubUser.login,
          },
        });
        console.log(
          `✅ Updated GitHub username for user ${currentUser.email}: ${githubUser.login}`
        );
      } catch (error) {
        console.error("Failed to update GitHub username:", error);
      }
    }

    if (state && state.length > 10 && state.length < 50) {
      if (!/^[a-zA-Z0-9_-]+$/.test(state)) {
        return NextResponse.redirect(
          `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
            "Invalid state parameter"
          )}`
        );
      }

      try {
        const { board } = await requireBoardAccess(state);

        const existingBoard = await prisma.board.findUnique({
          where: { id: state },
          select: { githubSyncEnabled: true },
        });

        if (!existingBoard?.githubSyncEnabled) {
          try {
            await requireGitHubIntegrationLimit(board.organizationId);
          } catch (limitError) {
            return NextResponse.redirect(
              `${NEXTAUTH_URL}/boards/${state}?error=${encodeURIComponent(
                limitError instanceof Error
                  ? limitError.message
                  : "GitHub integration limit reached"
              )}`
            );
          }
        }

        const encryptedToken = encryptToken(accessToken);

        await prisma.board.update({
          where: { id: state },
          data: {
            githubAccessToken: encryptedToken,
            githubSyncEnabled: true,
          },
        });

        return NextResponse.redirect(
          `${NEXTAUTH_URL}/boards/${state}?github=connected`
        );
      } catch (error) {
        return NextResponse.redirect(
          `${NEXTAUTH_URL}/boards?error=${encodeURIComponent(
            "Failed to connect GitHub"
          )}`
        );
      }
    }

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
