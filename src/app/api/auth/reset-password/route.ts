import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendPasswordChangedEmail } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  
  const rateLimitResponse = await rateLimiters.passwordReset(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    
    if (password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters long" },
        { status: 400 }
      );
    }

    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    );

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        },
        { status: 400 }
      );
    }

    
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    
    if (
      user.passwordResetTokenExpires &&
      user.passwordResetTokenExpires < new Date()
    ) {
      return NextResponse.json(
        { error: "Reset token has expired. Please request a new one." },
        { status: 400 }
      );
    }

    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
      },
    });

    
    try {
      await sendPasswordChangedEmail(user);
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
      
    }

    return NextResponse.json({
      message:
        "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
