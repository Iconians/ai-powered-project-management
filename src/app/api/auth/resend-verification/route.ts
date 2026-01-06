import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, sendEmailVerificationEmail } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  
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

    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    
    if (!user) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a verification email has been sent.",
      });
    }

    
    if (user.emailVerified) {
      return NextResponse.json({
        message: "Email is already verified. You can log in.",
      });
    }

    
    const verificationToken = generateToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); 

    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      },
    });

    
    try {
      await sendEmailVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return NextResponse.json(
        {
          error: "Failed to send verification email. Please try again later.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        "If an account with that email exists, a verification email has been sent.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process verification request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
