import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, sendPasswordResetEmail } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimiters.forgotPassword(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 1); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpires: tokenExpires,
      },
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user, resetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return NextResponse.json(
        {
          error: "Failed to send password reset email. Please try again later.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process password reset request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
