import "server-only";

import { getActiveTenantForUser, getTenantMembership } from "@/server/services/tenants.service";

export async function requireActiveTenant(userId: string, tenantId?: string) {
  if (tenantId) {
    return getTenantMembership({ userId, tenantId });
  }

  return getActiveTenantForUser({ userId });
}
