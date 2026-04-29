import "server-only";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type TenantContext = { userId: string; tenantId?: string };

export async function getActiveTenantForUser({ userId }: { userId: string }) {
  const membership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new DomainError("No se encontró un tenant activo para este usuario.", 403);
  }

  return membership;
}

export async function getTenantMembership({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    include: { tenant: true },
  });

  if (!membership || !membership.isActive) {
    throw new DomainError("Acceso no autorizado al tenant.", 403);
  }

  return membership;
}
