/**
 * Developer mode: organizations listed in DEVELOPER_ORGANIZATION_IDS get
 * full app access (unlimited limits, all AI features) without a paid plan.
 * Set in .env: DEVELOPER_ORGANIZATION_IDS=org-id-1,org-id-2
 */

const DEVELOPER_ORG_IDS_KEY = "DEVELOPER_ORGANIZATION_IDS";

function getDeveloperOrganizationIds(): string[] {
  const raw = process.env[DEVELOPER_ORG_IDS_KEY];
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isDeveloperOrganization(organizationId: string): boolean {
  const ids = getDeveloperOrganizationIds();
  return ids.includes(organizationId);
}
