import { prisma } from "@/lib/database";
import { SafeLogger } from "../logging/logger";

export interface CreateAuditLogParams {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  performedBy: string;
  correlationId?: string;
}

export class AuditService {
  public static log = async (params: CreateAuditLogParams): Promise<void> => {
    return AuditService.record(params);
  };

  public static async record(params: CreateAuditLogParams): Promise<void> {
    const {
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      performedBy,
      correlationId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    } = params;

    try {
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          performedBy,
          correlationId,
          timestamp: new Date(),
        },
      });

      SafeLogger.info("Audit log recorded", {
        entityType,
        entityId,
        action,
        performedBy,
        correlationId,
      });
    } catch (error) {
      // Never crash the primary workflow if audit write fails, but log error securely
      SafeLogger.error("Failed to write audit record", error, {
        entityType,
        entityId,
        action,
      });
    }
  }

  public static async query(filters?: {
    entityType?: string;
    entityId?: string;
    performedBy?: string;
    limit?: number;
  }) {
    return prisma.auditLog.findMany({
      where: {
        entityType: filters?.entityType,
        entityId: filters?.entityId,
        performedBy: filters?.performedBy,
      },
      orderBy: { timestamp: "desc" },
      take: filters?.limit ?? 100,
    });
  }
}
