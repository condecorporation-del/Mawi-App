import "server-only";

import { requireActiveTenant } from "@/lib/auth/tenant";
import { requireSession } from "@/lib/auth/session";

export async function getTenantContext(tenantId?: string) {
  const session = await requireSession();
  const membership = await requireActiveTenant(session.user.id, tenantId);

  return {
    tenantId: membership.tenantId,
    userId: session.user.id,
    tenantName: membership.tenant.name,
  };
}
