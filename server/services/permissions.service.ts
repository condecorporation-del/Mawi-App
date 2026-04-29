import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { Permission } from "@/lib/permissions/permissions";
import { hasPermission } from "@/lib/permissions/permissions";

export async function canPerformAction(
  { userId, tenantId }: { userId: string; tenantId: string },
  permission: Permission,
): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true, isActive: true },
  });

  if (!membership || !membership.isActive) return false;

  return hasPermission(membership.role, permission);
}
