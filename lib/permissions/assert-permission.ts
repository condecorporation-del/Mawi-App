import "server-only";

import { AuthorizationError } from "@/lib/errors/domain-error";
import type { Permission } from "@/lib/permissions/permissions";
import { canPerformAction } from "@/server/services/permissions.service";

export async function assertPermission(
  userId: string,
  tenantId: string,
  permission: Permission,
) {
  const allowed = await canPerformAction({ userId, tenantId }, permission);

  if (!allowed) {
    throw new AuthorizationError();
  }
}
