import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        emailVerified: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists (security)
      return NextResponse.json({ emailVerified: false });
    }

    return NextResponse.json({ emailVerified: user.emailVerified });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check email verification" },
      { status: 500 }
    );
  }
}

