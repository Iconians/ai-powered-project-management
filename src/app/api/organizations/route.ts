import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = slugify(name);
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this name already exists" },
        { status: 409 }
      );
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create organization";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch organizations";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

