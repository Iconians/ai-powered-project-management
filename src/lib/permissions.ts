import { MemberRole, BoardRole } from "@prisma/client";

export interface PermissionFlags {
  canCreateBoards?: boolean;
  canDeleteBoards?: boolean;
  canManageMembers?: boolean;
  canManageSettings?: boolean;
  canViewAnalytics?: boolean;
  canExportData?: boolean;
  canManageIntegrations?: boolean;
  canManageRoles?: boolean;
}

export interface PermissionContext {
  memberRole?: MemberRole;
  boardRole?: BoardRole;
  customPermissions?: PermissionFlags;
}

const defaultPermissions: Record<MemberRole, PermissionFlags> = {
  ADMIN: {
    canCreateBoards: true,
    canDeleteBoards: true,
    canManageMembers: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageIntegrations: true,
    canManageRoles: true,
  },
  MEMBER: {
    canCreateBoards: true,
    canDeleteBoards: false,
    canManageMembers: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canExportData: true,
    canManageIntegrations: false,
    canManageRoles: false,
  },
  VIEWER: {
    canCreateBoards: false,
    canDeleteBoards: false,
    canManageMembers: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageIntegrations: false,
    canManageRoles: false,
  },
};

const boardPermissions: Record<BoardRole, PermissionFlags> = {
  ADMIN: {
    canCreateBoards: true,
    canDeleteBoards: true,
    canManageMembers: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageIntegrations: false,
    canManageRoles: false,
  },
  MEMBER: {
    canCreateBoards: false,
    canDeleteBoards: false,
    canManageMembers: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canExportData: true,
    canManageIntegrations: false,
    canManageRoles: false,
  },
  VIEWER: {
    canCreateBoards: false,
    canDeleteBoards: false,
    canManageMembers: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageIntegrations: false,
    canManageRoles: false,
  },
};

export function getPermissions(context: PermissionContext): PermissionFlags {
  // If custom permissions are set, use those (they override default role permissions)
  if (context.customPermissions) {
    return context.customPermissions;
  }

  // For board-level permissions, use board role
  if (context.boardRole) {
    return boardPermissions[context.boardRole];
  }

  // For organization-level permissions, use member role
  if (context.memberRole) {
    return defaultPermissions[context.memberRole];
  }

  // Default: no permissions
  return {};
}

export function hasPermission(
  context: PermissionContext,
  permission: keyof PermissionFlags
): boolean {
  const permissions = getPermissions(context);
  return permissions[permission] === true;
}

export function requirePermission(
  context: PermissionContext,
  permission: keyof PermissionFlags
): void {
  if (!hasPermission(context, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

// Helper functions for common permission checks
export function canCreateBoard(context: PermissionContext): boolean {
  return hasPermission(context, "canCreateBoards");
}

export function canDeleteBoard(context: PermissionContext): boolean {
  return hasPermission(context, "canDeleteBoards");
}

export function canManageMembers(context: PermissionContext): boolean {
  return hasPermission(context, "canManageMembers");
}

export function canManageSettings(context: PermissionContext): boolean {
  return hasPermission(context, "canManageSettings");
}

export function canViewAnalytics(context: PermissionContext): boolean {
  return hasPermission(context, "canViewAnalytics");
}

export function canExportData(context: PermissionContext): boolean {
  return hasPermission(context, "canExportData");
}

export function canManageIntegrations(context: PermissionContext): boolean {
  return hasPermission(context, "canManageIntegrations");
}

export function canManageRoles(context: PermissionContext): boolean {
  return hasPermission(context, "canManageRoles");
}
