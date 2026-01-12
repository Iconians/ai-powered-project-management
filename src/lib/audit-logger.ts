import { prisma } from "./prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT";
export type AuditEntityType =
  | "TASK"
  | "BOARD"
  | "MEMBER"
  | "ORGANIZATION"
  | "SPRINT"
  | "COMMENT"
  | "ATTACHMENT";

export interface AuditLogData {
  organizationId?: string;
  boardId?: string;
  taskId?: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: data.organizationId || null,
        boardId: data.boardId || null,
        taskId: data.taskId || null,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes ? (data.changes as any) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

