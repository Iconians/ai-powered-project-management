import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id: organizationId, roleId } = await params;
    const body = await request.json();
    const { name, permissions } = body;

    await requireMember(organizationId, "ADMIN");

    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (permissions !== undefined) updateData.permissions = permissions;

    const updated = await prisma.customRole.update({
      where: { id: roleId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id: organizationId, roleId } = await params;

    await requireMember(organizationId, "ADMIN");

    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role._count.members > 0) {
      return NextResponse.json(
        { error: "Cannot delete role with assigned members" },
        { status: 400 }
      );
    }

    await prisma.customRole.delete({
      where: { id: roleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
