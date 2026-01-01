import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getCurrentUsage, getActualCounts } from "@/lib/usage";

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

    await requireMember(organizationId);

    const [usage, actualCounts] = await Promise.all([
      getCurrentUsage(organizationId),
      getActualCounts(organizationId),
    ]);

    return NextResponse.json({
      usage,
      actualCounts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch usage";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

