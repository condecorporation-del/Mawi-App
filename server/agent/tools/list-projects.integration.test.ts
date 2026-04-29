import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/server/agent/tools/types";

type ListProjectsResult = {
  projects: Array<{
    projectId: string;
    code: string;
    name: string;
    status: string;
    budgetCents: number;
    expenseCents: number;
    receivableCents: number;
    payableCents: number;
    varianceCents: number;
  }>;
  total: number;
};

let context: ToolExecutionContext;
let prisma: {
  membership: {
    findFirst: (...args: unknown[]) => Promise<{ tenantId: string; userId: string } | null>;
  };
  project: {
    findFirst: (...args: unknown[]) => Promise<{ id: string } | null>;
    count: (...args: unknown[]) => Promise<number>;
  };
};
let getOrCreateConversation: (
  ctx: { tenantId: string; userId: string },
  opts: { title?: string },
) => Promise<{ id: string }>;
let executeResolvedTool: (
  context: ToolExecutionContext,
  toolName: string,
  rawInput: unknown,
) => Promise<unknown>;

beforeAll(async () => {
  vi.mock("server-only", () => ({}));

  const [dbModule, conversationModule, resolverModule] = await Promise.all([
    import("@/lib/db/prisma"),
    import("@/server/agent/conversation.service"),
    import("@/server/agent/tools/resolver"),
  ]);

  prisma = dbModule.prisma as unknown as typeof prisma;
  getOrCreateConversation = conversationModule.getOrCreateConversation;
  executeResolvedTool = resolverModule.executeResolvedTool;

  const membership = await prisma.membership.findFirst({
    where: { isActive: true, role: "owner" },
    select: { tenantId: true, userId: true },
  });
  if (!membership) {
    throw new Error("No active owner membership found for list-projects integration test.");
  }

  const conversation = await getOrCreateConversation(
    { tenantId: membership.tenantId, userId: membership.userId },
    { title: "list-projects integration test" },
  );

  context = {
    tenantId: membership.tenantId,
    userId: membership.userId,
    conversationId: conversation.id,
  };
});

describe("project.list tool", () => {
  it("returns project list with KPIs for owner role", async () => {
    const result = (await executeResolvedTool(
      context,
      "project.list",
      {},
    )) as ListProjectsResult;

    expect(result).toHaveProperty("projects");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.projects)).toBe(true);
    expect(result.total).toBe(result.projects.length);

    const projectCount = await prisma.project.count({
      where: { tenantId: context.tenantId, deletedAt: null, archivedAt: null },
    });
    expect(result.total).toBe(projectCount);

    if (result.projects.length > 0) {
      const first = result.projects[0];
      expect(first).toHaveProperty("projectId");
      expect(first).toHaveProperty("code");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("status");
      expect(typeof first.budgetCents).toBe("number");
      expect(typeof first.expenseCents).toBe("number");
      expect(typeof first.varianceCents).toBe("number");
      // varianceCents must equal budget minus expenses
      expect(first.varianceCents).toBe(first.budgetCents - first.expenseCents);
    }
  }, 20_000);

  it("filters by status when provided", async () => {
    const activeResult = (await executeResolvedTool(
      context,
      "project.list",
      { status: "active" },
    )) as ListProjectsResult;

    expect(Array.isArray(activeResult.projects)).toBe(true);
    for (const p of activeResult.projects) {
      expect(p.status).toBe("active");
    }
  }, 20_000);

  it("member-role user can list projects (agent.chat permission)", async () => {
    const memberMembership = await (
      prisma as unknown as {
        membership: {
          findFirst: (args: unknown) => Promise<{ tenantId: string; userId: string } | null>;
        };
      }
    ).membership.findFirst({
      where: { isActive: true, role: "member" },
      select: { tenantId: true, userId: true },
    });

    if (!memberMembership) {
      console.warn("[list-projects test] No member user found — skipping member permission check");
      return;
    }

    const memberConv = await getOrCreateConversation(
      { tenantId: memberMembership.tenantId, userId: memberMembership.userId },
      { title: "list-projects member test" },
    );

    const memberCtx: ToolExecutionContext = {
      tenantId: memberMembership.tenantId,
      userId: memberMembership.userId,
      conversationId: memberConv.id,
    };

    const result = (await executeResolvedTool(
      memberCtx,
      "project.list",
      {},
    )) as ListProjectsResult;

    expect(result).toHaveProperty("projects");
    expect(Array.isArray(result.projects)).toBe(true);
  }, 20_000);
});
