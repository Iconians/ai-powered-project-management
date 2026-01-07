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

    const roles = await prisma.customRole.findMany({
      where: { organizationId: id },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch roles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, permissions } = body;

    if (!name || !permissions) {
      return NextResponse.json(
        { error: "name and permissions are required" },
        { status: 400 }
      );
    }

    await requireMember(id, "ADMIN");

    const role = await prisma.customRole.create({
      data: {
        organizationId: id,
        name,
        permissions,
      },
    });

    return NextResponse.json(role);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

