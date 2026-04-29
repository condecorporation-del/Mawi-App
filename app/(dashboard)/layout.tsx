import { redirect } from "next/navigation";
import { AlertStatus } from "@prisma/client";

import { AgentPanel } from "@/components/agent/agent-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { getUnreadNotificationCount } from "@/server/services/notifications.service";
import { listProjects } from "@/server/services/projects.service";
import { prisma } from "@/lib/db/prisma";
import { logoutAction } from "@/app/(auth)/login/actions";

type DashboardLayoutProps = Readonly<{ children: React.ReactNode }>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  try {
    const membership = await requireActiveTenant(session.user.id);
    await assertPermission(session.user.id, membership.tenantId, "dashboard.read");

    const ctx = { tenantId: membership.tenantId, userId: session.user.id };

    const [unreadNotifications, projects, openAlertsCount] = await Promise.all([
      getUnreadNotificationCount(ctx),
      listProjects(ctx, {}),
      prisma.alert.count({ where: { tenantId: membership.tenantId, status: AlertStatus.open } }),
    ]);

    const totalBudgetCents = projects.reduce((s, p) => s + p.budgetCents, 0);
    const totalSpentCents  = projects.reduce((s, p) => s + p.spentCents, 0);

    return (
      <div className="blueprint-grid min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface">
        <Sidebar />

        <div className="ml-20 flex min-h-screen min-w-0 flex-col">
          <Topbar
            tenantName={membership.tenant.name}
            userEmail={session.user.email}
            unreadNotifications={unreadNotifications}
            totalBudgetCents={totalBudgetCents}
            totalSpentCents={totalSpentCents}
            openAlertsCount={openAlertsCount}
            logoutAction={logoutAction}
          />
          <main className="flex-1 p-8">{children}</main>
        </div>

        <AgentPanel />
      </div>
    );
  } catch {
    redirect("/login?error=No%20encontramos%20un%20tenant%20activo");
  }
}
