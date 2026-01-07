import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "VIEWER");

    const integrations = await prisma.integration.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(integrations);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch integrations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, provider, config } = body;

    if (!organizationId || !provider) {
      return NextResponse.json(
        { error: "organizationId and provider are required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "ADMIN");

    const validProviders = Object.values(IntegrationProvider);
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `provider must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if integration already exists
    const existing = await prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider,
        },
      },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          config: config || {},
          isActive: true,
        },
      });
    } else {
      integration = await prisma.integration.create({
        data: {
          organizationId,
          provider,
          config: config || {},
        },
      });
    }

    return NextResponse.json(integration);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create integration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

