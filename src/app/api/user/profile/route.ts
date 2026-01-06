import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimiters } from "@/lib/rate-limit";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        githubUsername: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(dbUser);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    
    const rateLimitResponse = await rateLimiters.api(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { name, password, currentPassword } = body;

    const updateData: {
      name?: string;
      password?: string;
    } = {};

    
    if (name !== undefined) {
      if (name.length > 100) {
        return NextResponse.json(
          { error: "Name must be less than 100 characters" },
          { status: 400 }
        );
      }
      updateData.name = name || null;
    }

    
    if (password !== undefined) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password" },
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

      
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const isValid = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      
      updateData.password = await bcrypt.hash(password, 10);
    }

    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        githubUsername: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
