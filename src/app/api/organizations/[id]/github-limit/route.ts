import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { checkGitHubIntegrationLimit } from "@/lib/limits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    await requireMember(organizationId);

    const result = await checkGitHubIntegrationLimit(organizationId);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check GitHub limit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

