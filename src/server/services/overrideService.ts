import { prisma } from "@/lib/database";
import { OverrideState } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { AuditService } from "./auditService";
import { SessionUser } from "../auth/session";
import { AuthorizationService } from "../authorization/service";

export interface CreateOverrideInput {
  personId: string;
  supportGroupId: string;
  overrideState: OverrideState;
  startAt: string; // ISO string
  expiresAt?: string | null; // ISO string
  reason: string;
}

export class OverrideService {
  public static async create(input: CreateOverrideInput, user: SessionUser) {
    AuthorizationService.assertCanManageSupportGroup(user, input.supportGroupId);

    const override = await prisma.availabilityOverride.create({
      data: {
        personId: input.personId,
        supportGroupId: input.supportGroupId,
        overrideState: input.overrideState,
        startAt: new Date(input.startAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        reason: input.reason,
        createdBy: user.loginName,
      },
      include: {
        person: true,
        supportGroup: true,
      },
    });

    await AuditService.log({
      entityType: "AVAILABILITY_OVERRIDE",
      entityId: override.id,
      action: "CREATE",
      newValue: override,
      performedBy: user.loginName,
    });

    return override;
  }

  public static async cancel(id: string, user: SessionUser) {
    const existing = await prisma.availabilityOverride.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Override ${id} not found`);
    }

    AuthorizationService.assertCanManageSupportGroup(user, existing.supportGroupId);

    const cancelled = await prisma.availabilityOverride.update({
      where: { id },
      data: {
        cancelledAt: new Date(),
        cancelledBy: user.loginName,
      },
    });

    await AuditService.log({
      entityType: "AVAILABILITY_OVERRIDE",
      entityId: id,
      action: "CANCEL",
      oldValue: existing,
      newValue: cancelled,
      performedBy: user.loginName,
    });

    return cancelled;
  }

  public static async getActiveOverrides(supportGroupId?: string) {
    const now = new Date();
    return prisma.availabilityOverride.findMany({
      where: {
        ...(supportGroupId ? { supportGroupId } : {}),
        cancelledAt: null,
        startAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        person: true,
        supportGroup: true,
      },
      orderBy: { startAt: "desc" },
    });
  }
}
