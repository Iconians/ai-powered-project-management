import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateToken, sendEmailVerificationEmail } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  
  const rateLimitResponse = await rateLimiters.signup(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
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

    
    if (name && name.length > 100) {
      return NextResponse.json(
        { error: "Name must be less than 100 characters" },
        { status: 400 }
      );
    }

    
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const verificationToken = generateToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); 

    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      },
    });

    
    try {
      await sendEmailVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        message:
          "Account created. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
