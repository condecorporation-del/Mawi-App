import "server-only";

import { createAuditLog, type CreateAuditLogInput } from "@/server/services/audit.service";

export async function recordAuditLog(input: CreateAuditLogInput) {
  return createAuditLog(input);
}
