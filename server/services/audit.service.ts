import "server-only";

import { ActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateAuditLogInput = {
  tenantId: string;
  actorUserId?: string;
  actorType?: ActorType;
  entityType: string;
  entityId?: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? ActorType.user,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
      after: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}
