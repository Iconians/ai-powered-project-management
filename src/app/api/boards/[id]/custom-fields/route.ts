import { NextRequest, NextResponse } from "next/server";
import { requireBoardAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";
import { CustomFieldType } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await requireBoardAccess(id, "VIEWER");

    const customFields = await prisma.customField.findMany({
      where: { boardId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(customFields);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch custom fields";
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
    const { name, type, required, options, order, isVisible } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "name and type are required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(id, "ADMIN");

    const validTypes = Object.values(CustomFieldType);
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get max order if not provided
    let fieldOrder = order;
    if (fieldOrder === undefined) {
      const maxField = await prisma.customField.findFirst({
        where: { boardId: id },
        orderBy: { order: "desc" },
      });
      fieldOrder = maxField ? maxField.order + 1 : 0;
    }

    const customField = await prisma.customField.create({
      data: {
        boardId: id,
        name,
        type,
        required: required || false,
        options: options || null,
        order: fieldOrder,
        isVisible: isVisible !== undefined ? isVisible : true,
      },
    });

    await triggerPusherEvent(`board-${id}`, "custom-field-created", customField);

    return NextResponse.json(customField);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create custom field";
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
    const { fieldId, name, type, required, options, order, isVisible } = body;

    if (!fieldId) {
      return NextResponse.json(
        { error: "fieldId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(id, "ADMIN");

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes = Object.values(CustomFieldType);
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `type must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.type = type;
    }
    if (required !== undefined) updateData.required = required;
    if (options !== undefined) updateData.options = options;
    if (order !== undefined) updateData.order = order;
    if (isVisible !== undefined) updateData.isVisible = isVisible;

    const customField = await prisma.customField.update({
      where: { id: fieldId },
      data: updateData,
    });

    await triggerPusherEvent(`board-${id}`, "custom-field-updated", customField);

    return NextResponse.json(customField);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update custom field";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get("fieldId");

    if (!fieldId) {
      return NextResponse.json(
        { error: "fieldId is required" },
        { status: 400 }
      );
    }

    await requireBoardAccess(id, "ADMIN");

    await prisma.customField.delete({
      where: { id: fieldId },
    });

    await triggerPusherEvent(`board-${id}`, "custom-field-deleted", {
      fieldId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete custom field";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

