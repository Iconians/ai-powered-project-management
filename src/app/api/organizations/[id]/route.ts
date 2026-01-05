import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireMember(id); // Verify user is a member

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            boards: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // Check if user is admin
    await requireMember(id, "ADMIN");

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Input validation
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Organization name must be less than 100 characters" },
        { status: 400 }
      );
    }

    // Sanitize: Remove potentially dangerous characters
    if (/[<>\"'&]/.test(name)) {
      return NextResponse.json(
        { error: "Organization name contains invalid characters" },
        { status: 400 }
      );
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user is admin
    await requireMember(id, "ADMIN");

    // Check if this is the last admin
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          where: { role: "ADMIN" },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Prevent deletion if there are multiple admins (safety check)
    // Actually, we'll allow deletion - the admin who initiates it should be able to delete
    // But we could add a confirmation step in the UI

    // Delete the organization (cascade will handle related data)
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete organization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
