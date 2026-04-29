import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let activeUserId = "test-user-1";
const activeTenantId = "00000000-0000-0000-0000-000000000001";
const activeTenantName = "Tenant Test 1";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () => ({
    user: { id: activeUserId },
  }),
}));

vi.mock("@/lib/auth/tenant", () => ({
  requireActiveTenant: async () => ({
    tenantId: activeTenantId,
    tenant: { name: activeTenantName },
  }),
}));

vi.mock("@/lib/permissions/assert-permission", () => ({
  assertPermission: async () => undefined,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, resetAt: Date.now() + 60_000 }),
}));

vi.mock("@/server/agent/agent-runtime", () => ({
  runAgentStream: async (input: {
    ctx: { tenantId: string; userId: string; conversationId: string; confirmationToken?: string };
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }) => {
    const { executeResolvedTool } = await import("@/server/agent/tools/resolver");
    const lastMessage = input.messages[input.messages.length - 1]?.content ?? "";

    let body = JSON.stringify({ error: "Mensaje invalido para test HTTP." });
    try {
      const parsed = JSON.parse(lastMessage) as {
        toolName: string;
        rawInput: unknown;
      };
      const result = await executeResolvedTool(
        input.ctx,
        parsed.toolName,
        parsed.rawInput,
      );
      body = JSON.stringify(result);
    } catch (error) {
      body = JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido.",
      });
    }

    return {
      toTextStreamResponse() {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            controller.close();
          },
        }));
      },
    };
  },
}));

describe("POST /api/agent/chat TASK-038 HTTP evidence", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db/prisma");

    const tenant = await prisma.tenant.findFirst({
      where: { id: activeTenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error("Tenant base no encontrado para pruebas HTTP.");
    }

    const membership = await prisma.membership.findFirst({
      where: { tenantId: activeTenantId, userId: activeUserId, isActive: true },
      select: { id: true },
    });
    if (!membership) {
      await prisma.membership.create({
        data: {
          tenantId: activeTenantId,
          userId: activeUserId,
          role: "owner",
          isActive: true,
        },
      });
    }

    const secondMembership = await prisma.membership.findFirst({
      where: { tenantId: activeTenantId, userId: "test-user-2", isActive: true },
      select: { id: true },
    });
    if (!secondMembership) {
      await prisma.membership.create({
        data: {
          tenantId: activeTenantId,
          userId: "test-user-2",
          role: "owner",
          isActive: true,
        },
      });
    }
  });

  it("validates confirmation, execution, idempotency, audit logs and isolation", async () => {
    const { POST } = await import("./route");
    const { prisma } = await import("@/lib/db/prisma");

    const project = await prisma.project.findFirst({
      where: { tenantId: activeTenantId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new Error("No hay proyecto disponible para prueba HTTP.");
    }

    const supplier = await prisma.supplier.findFirst({
      where: { tenantId: activeTenantId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) {
      throw new Error("No hay proveedor disponible para prueba HTTP.");
    }

    const runTag = `${Date.now()}`;
    const expenseIdempotencyKey = `http-expense-${runTag}`;
    const invoiceIdempotencyKey = `http-invoice-${runTag}`;

    const expenseRawInput = {
      idempotencyKey: expenseIdempotencyKey,
      projectId: project.id,
      supplierId: supplier.id,
      description: `HTTP expense ${runTag}`,
      totalCents: 15000,
      expenseDate: new Date().toISOString(),
    };

    const invoiceRawInput = {
      idempotencyKey: invoiceIdempotencyKey,
      supplierId: supplier.id,
      projectId: project.id,
      number: `HTTP-${runTag}`,
      issueDate: new Date().toISOString(),
      totalCents: 22000,
    };

    // 1) primer POST -> confirmation_required (expense)
    const firstExpense = await postChat(POST, {
      message: JSON.stringify({
        toolName: "expense.create_draft",
        rawInput: expenseRawInput,
      }),
    });
    expect(firstExpense.status).toBe(200);
    expect(firstExpense.json.status).toBe("confirmation_required");
    expect(typeof firstExpense.json.confirmationToken).toBe("string");

    // 2) segundo POST con confirmationToken -> ejecuta
    const executeExpense = await postChat(POST, {
      conversationId: firstExpense.conversationId,
      confirmationToken: firstExpense.json.confirmationToken,
      message: JSON.stringify({
        toolName: "expense.create_draft",
        rawInput: expenseRawInput,
      }),
    });
    expect(executeExpense.status).toBe(200);
    expect(executeExpense.json.status).toBe("executed");
    expect(executeExpense.json.idempotencyKey).toBe(expenseIdempotencyKey);

    // 3) retry mismo idempotencyKey -> no duplica
    const retryExpense = await postChat(POST, {
      conversationId: firstExpense.conversationId,
      message: JSON.stringify({
        toolName: "expense.create_draft",
        rawInput: expenseRawInput,
      }),
    });
    expect(retryExpense.json.status).toBe("executed");
    expect(retryExpense.json.expenseId).toBe(executeExpense.json.expenseId);

    const expenseCount = await prisma.expense.count({
      where: {
        tenantId: activeTenantId,
        clientGenId: expenseIdempotencyKey,
        deletedAt: null,
      },
    });
    expect(expenseCount).toBe(1);

    // Factura proveedor: confirmation -> execute -> retry idempotente
    const firstInvoice = await postChat(POST, {
      conversationId: firstExpense.conversationId,
      message: JSON.stringify({
        toolName: "invoice.register_supplier_invoice",
        rawInput: invoiceRawInput,
      }),
    });
    expect(firstInvoice.json.status).toBe("confirmation_required");
    expect(typeof firstInvoice.json.confirmationToken).toBe("string");

    const executeInvoice = await postChat(POST, {
      conversationId: firstExpense.conversationId,
      confirmationToken: firstInvoice.json.confirmationToken,
      message: JSON.stringify({
        toolName: "invoice.register_supplier_invoice",
        rawInput: invoiceRawInput,
      }),
    });
    expect(executeInvoice.json.status).toBe("executed");
    expect(executeInvoice.json.idempotencyKey).toBe(invoiceIdempotencyKey);

    const retryInvoice = await postChat(POST, {
      conversationId: firstExpense.conversationId,
      message: JSON.stringify({
        toolName: "invoice.register_supplier_invoice",
        rawInput: invoiceRawInput,
      }),
    });
    expect(retryInvoice.json.status).toBe("executed");
    expect(retryInvoice.json.invoiceId).toBe(executeInvoice.json.invoiceId);

    const invoiceCount = await prisma.invoice.count({
      where: {
        tenantId: activeTenantId,
        number: invoiceRawInput.number,
        supplierId: invoiceRawInput.supplierId,
        deletedAt: null,
      },
    });
    expect(invoiceCount).toBe(1);

    // 4) audit logs success/failed
    await postChat(POST, {
      conversationId: firstExpense.conversationId,
      message: JSON.stringify({
        toolName: "expense.create_draft",
        rawInput: {
          idempotencyKey: `http-expense-error-${runTag}`,
          description: "x",
        },
      }),
    });
    await postChat(POST, {
      conversationId: firstExpense.conversationId,
      message: JSON.stringify({
        toolName: "invoice.register_supplier_invoice",
        rawInput: {
          idempotencyKey: `http-invoice-error-${runTag}`,
          supplierId: "bad-uuid",
          number: "BAD",
          issueDate: "bad-date",
          totalCents: -1,
        },
      }),
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: activeTenantId,
        entityType: "agent_tool",
        action: {
          in: [
            "agent.tool.expense_create_draft.executed",
            "agent.tool.expense_create_draft.executed.failed",
            "agent.tool.invoice_register_supplier_invoice.executed",
            "agent.tool.invoice_register_supplier_invoice.executed.failed",
          ],
        },
      },
      select: { action: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    expect(hasLog(logs, "agent.tool.expense_create_draft.executed", expenseIdempotencyKey)).toBe(true);
    expect(hasLog(logs, "agent.tool.expense_create_draft.executed.failed", `http-expense-error-${runTag}`)).toBe(true);
    expect(hasLog(logs, "agent.tool.invoice_register_supplier_invoice.executed", invoiceIdempotencyKey)).toBe(true);
    expect(hasLog(logs, "agent.tool.invoice_register_supplier_invoice.executed.failed", `http-invoice-error-${runTag}`)).toBe(true);

    // 5) aislamiento tenant/user en conversación
    activeUserId = "test-user-2";
    const secondUserCall = await postChat(POST, {
      message: JSON.stringify({
        toolName: "expense.create_draft",
        rawInput: {
          idempotencyKey: `http-expense-user2-${runTag}`,
          projectId: project.id,
          supplierId: supplier.id,
          description: `HTTP expense user2 ${runTag}`,
          totalCents: 11100,
          expenseDate: new Date().toISOString(),
        },
      }),
    });

    expect(secondUserCall.conversationId).not.toBe(firstExpense.conversationId);

    const convUser1 = await prisma.conversation.findUnique({
      where: { id: firstExpense.conversationId },
      select: { userId: true, tenantId: true },
    });
    const convUser2 = await prisma.conversation.findUnique({
      where: { id: secondUserCall.conversationId },
      select: { userId: true, tenantId: true },
    });

    expect(convUser1?.tenantId).toBe(activeTenantId);
    expect(convUser2?.tenantId).toBe(activeTenantId);
    expect(convUser1?.userId).toBe("test-user-1");
    expect(convUser2?.userId).toBe("test-user-2");
  }, 90_000);
});

type RoutePost = (req: NextRequest) => Promise<Response>;

async function postChat(post: RoutePost, body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/agent/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
  const response = await post(req);
  const conversationId = response.headers.get("X-Conversation-Id");
  const text = await response.text();
  const json = JSON.parse(text) as Record<string, unknown>;

  if (!conversationId) {
    throw new Error("Response without conversation id header.");
  }

  return {
    status: response.status,
    conversationId,
    json,
  };
}

function hasLog(
  logs: Array<{ action: string; metadata: unknown }>,
  action: string,
  idempotencyKey: string,
) {
  return logs.some((log) => {
    if (log.action !== action) return false;
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      return false;
    }
    const metadata = log.metadata as Record<string, unknown>;
    return metadata.idempotencyKey === idempotencyKey;
  });
}
