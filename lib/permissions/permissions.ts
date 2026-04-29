import { TenantRole } from "@prisma/client";

export const PERMISSIONS = [
  "tenant.read",
  "tenant.manage_members",
  "dashboard.read",
  "audit.create",
  "audit.read",
  "client.manage",
  "supplier.manage",
  "project.manage",
  "invoice.manage",
  "payment.create",
  "expense.manage",
  "agent.chat",
  "agent.execute_financial_action",
  "report.ai_generate",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  [TenantRole.owner]: PERMISSIONS,
  [TenantRole.admin]: [
    ...PERMISSIONS.filter((p) => p !== "tenant.manage_members"),
  ],
  [TenantRole.member]: [
    "tenant.read",
    "dashboard.read",
    "audit.create",
    "agent.chat",
    "expense.manage",
  ],
  [TenantRole.viewer]: ["tenant.read", "dashboard.read"],
};

export function hasPermission(role: TenantRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
