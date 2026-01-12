import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireMember(id, "VIEWER");

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: id },
    });

    return NextResponse.json(settings || {
      organizationId: id,
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customDomain: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireMember(id, "ADMIN");

    const body = await request.json();
    const { logoUrl, primaryColor, secondaryColor, customDomain } = body;

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: id },
      update: {
        logoUrl: logoUrl !== undefined ? logoUrl : undefined,
        primaryColor: primaryColor !== undefined ? primaryColor : undefined,
        secondaryColor: secondaryColor !== undefined ? secondaryColor : undefined,
        customDomain: customDomain !== undefined ? customDomain : undefined,
      },
      create: {
        organizationId: id,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        customDomain: customDomain || null,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
