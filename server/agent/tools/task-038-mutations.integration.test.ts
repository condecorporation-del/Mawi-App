import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/server/agent/tools/types";

type ConfirmationRequiredResponse = {
  status: "confirmation_required";
  summary: string;
  confirmationToken: string;
};

type ExecutedExpenseResponse = {
  status: "executed";
  expenseId: string;
  idempotencyKey: string;
};

type ExecutedInvoiceResponse = {
  status: "executed";
  invoiceId: string;
  idempotencyKey: string;
};

let context: ToolExecutionContext;
let projectId: string;
let supplierId: string;
let prisma: {
  membership: { findFirst: (...args: unknown[]) => Promise<{ tenantId: string; userId: string } | null> };
  project: { findFirst: (...args: unknown[]) => Promise<{ id: string } | null> };
  supplier: { findFirst: (...args: unknown[]) => Promise<{ id: string } | null> };
  expense: { count: (...args: unknown[]) => Promise<number> };
  invoice: { count: (...args: unknown[]) => Promise<number> };
  auditLog: { findMany: (...args: unknown[]) => Promise<Array<{ action: string; metadata: unknown }>> };
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
let ToolExecutionErrorCtor: (new (...args: never[]) => Error) | undefined;

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
  ToolExecutionErrorCtor = resolverModule.ToolExecutionError;

  const membership = await prisma.membership.findFirst({
    where: { isActive: true, role: "owner" },
    select: { tenantId: true, userId: true },
  });
  if (!membership) {
    throw new Error("No active owner membership found for integration test.");
  }

  let project = await prisma.project.findFirst({
    where: { tenantId: membership.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    const projectWriter = prisma as unknown as {
      project: {
        create: (args: {
          data: {
            tenantId: string;
            code: string;
            name: string;
            status: "active";
            budgetCents: number;
            createdBy: string;
            updatedBy: string;
          };
          select: { id: true };
        }) => Promise<{ id: string }>;
      };
    };
    project = await projectWriter.project.create({
      data: {
        tenantId: membership.tenantId,
        code: `T038-${Date.now()}`,
        name: "Proyecto pruebas TASK-038",
        status: "active",
        budgetCents: 100_000_000,
        createdBy: membership.userId,
        updatedBy: membership.userId,
      },
      select: { id: true },
    });
  }

  let supplier = await prisma.supplier.findFirst({
    where: { tenantId: membership.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!supplier) {
    const supplierWriter = prisma as unknown as {
      supplier: {
        create: (args: {
          data: {
            tenantId: string;
            name: string;
            createdBy: string;
            updatedBy: string;
          };
          select: { id: true };
        }) => Promise<{ id: string }>;
      };
    };
    supplier = await supplierWriter.supplier.create({
      data: {
        tenantId: membership.tenantId,
        name: "Proveedor pruebas TASK-038",
        createdBy: membership.userId,
        updatedBy: membership.userId,
      },
      select: { id: true },
    });
  }

  const conversation = await getOrCreateConversation(
    { tenantId: membership.tenantId, userId: membership.userId },
    { title: "TASK-038 integration run" },
  );

  context = {
    tenantId: membership.tenantId,
    userId: membership.userId,
    conversationId: conversation.id,
  };
  projectId = project.id;
  supplierId = supplier.id;
});

describe("TASK-038 mutation tools with confirmation", () => {
  it("covers confirmation, execution, idempotency and audit logs", async () => {
    const runTag = Date.now().toString();

    const expenseInput = {
      idempotencyKey: `t038-expense-${runTag}`,
      projectId,
      supplierId,
      description: `Gasto de prueba TASK-038 ${runTag}`,
      totalCents: 12345,
      expenseDate: new Date().toISOString(),
    };

    const invoiceInput = {
      idempotencyKey: `t038-invoice-${runTag}`,
      supplierId,
      projectId,
      number: `T038-${runTag}`,
      issueDate: new Date().toISOString(),
      totalCents: 67890,
    };

    const firstExpenseTry = (await executeResolvedTool(
      context,
      "expense.create_draft",
      expenseInput,
    )) as ConfirmationRequiredResponse;
    console.log("[TASK-038][expense][first]", JSON.stringify(firstExpenseTry));

    expect(firstExpenseTry.status).toBe("confirmation_required");
    expect(firstExpenseTry.confirmationToken).toBeTruthy();

    const invalidExpenseConfirmation = (await executeResolvedTool(
      { ...context, confirmationToken: "invalid-token" },
      "expense.create_draft",
      expenseInput,
    )) as ConfirmationRequiredResponse;
    expect(invalidExpenseConfirmation.status).toBe("confirmation_required");

    const confirmedExpense = (await executeResolvedTool(
      { ...context, confirmationToken: firstExpenseTry.confirmationToken },
      "expense.create_draft",
      expenseInput,
    )) as ExecutedExpenseResponse;
    console.log("[TASK-038][expense][confirmed]", JSON.stringify(confirmedExpense));

    expect(confirmedExpense.status).toBe("executed");
    expect(confirmedExpense.idempotencyKey).toBe(expenseInput.idempotencyKey);

    const repeatedExpense = (await executeResolvedTool(
      context,
      "expense.create_draft",
      expenseInput,
    )) as ExecutedExpenseResponse;
    console.log("[TASK-038][expense][idempotent]", JSON.stringify(repeatedExpense));

    expect(repeatedExpense.status).toBe("executed");
    expect(repeatedExpense.expenseId).toBe(confirmedExpense.expenseId);

    const expenseCount = await prisma.expense.count({
      where: {
        tenantId: context.tenantId,
        clientGenId: expenseInput.idempotencyKey,
        deletedAt: null,
      },
    });
    expect(expenseCount).toBe(1);

    const firstInvoiceTry = (await executeResolvedTool(
      context,
      "invoice.register_supplier_invoice",
      invoiceInput,
    )) as ConfirmationRequiredResponse;
    console.log("[TASK-038][invoice][first]", JSON.stringify(firstInvoiceTry));

    expect(firstInvoiceTry.status).toBe("confirmation_required");
    expect(firstInvoiceTry.confirmationToken).toBeTruthy();

    const invalidInvoiceConfirmation = (await executeResolvedTool(
      { ...context, confirmationToken: "invalid-token" },
      "invoice.register_supplier_invoice",
      invoiceInput,
    )) as ConfirmationRequiredResponse;
    expect(invalidInvoiceConfirmation.status).toBe("confirmation_required");

    const confirmedInvoice = (await executeResolvedTool(
      { ...context, confirmationToken: firstInvoiceTry.confirmationToken },
      "invoice.register_supplier_invoice",
      invoiceInput,
    )) as ExecutedInvoiceResponse;
    console.log("[TASK-038][invoice][confirmed]", JSON.stringify(confirmedInvoice));

    expect(confirmedInvoice.status).toBe("executed");
    expect(confirmedInvoice.idempotencyKey).toBe(invoiceInput.idempotencyKey);

    const repeatedInvoice = (await executeResolvedTool(
      context,
      "invoice.register_supplier_invoice",
      invoiceInput,
    )) as ExecutedInvoiceResponse;
    console.log("[TASK-038][invoice][idempotent]", JSON.stringify(repeatedInvoice));

    expect(repeatedInvoice.status).toBe("executed");
    expect(repeatedInvoice.invoiceId).toBe(confirmedInvoice.invoiceId);

    const secondConversation = await getOrCreateConversation(
      { tenantId: context.tenantId, userId: context.userId },
      { title: "TASK-038 integration dedupe check" },
    );
    const repeatedFromAnotherConversation = (await executeResolvedTool(
      {
        ...context,
        conversationId: secondConversation.id,
      },
      "invoice.register_supplier_invoice",
      invoiceInput,
    )) as ExecutedInvoiceResponse;
    expect(repeatedFromAnotherConversation.invoiceId).toBe(confirmedInvoice.invoiceId);

    const invoiceCount = await prisma.invoice.count({
      where: {
        tenantId: context.tenantId,
        clientGenId: invoiceInput.idempotencyKey,
        deletedAt: null,
      },
    });
    expect(invoiceCount).toBe(1);

    const badExpenseInput = {
      idempotencyKey: `t038-expense-error-${runTag}`,
      description: "x",
    };
    await expect(
      executeResolvedTool(context, "expense.create_draft", badExpenseInput),
    ).rejects.toBeInstanceOf(ToolExecutionErrorCtor!);

    const badInvoiceInput = {
      idempotencyKey: `t038-invoice-error-${runTag}`,
      supplierId: "not-a-uuid",
      number: "BAD",
      issueDate: "bad-date",
      totalCents: -1,
    };
    await expect(
      executeResolvedTool(context, "invoice.register_supplier_invoice", badInvoiceInput),
    ).rejects.toBeInstanceOf(ToolExecutionErrorCtor!);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: context.tenantId,
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
      take: 30,
    });

    const hasExpenseSuccess = auditLogs.some((log) => {
      const metadata = toMetadata(log.metadata);
      return (
        log.action === "agent.tool.expense_create_draft.executed" &&
        metadata?.idempotencyKey === expenseInput.idempotencyKey
      );
    });

    const hasExpenseError = auditLogs.some((log) => {
      const metadata = toMetadata(log.metadata);
      return (
        log.action === "agent.tool.expense_create_draft.executed.failed" &&
        metadata?.idempotencyKey === badExpenseInput.idempotencyKey
      );
    });

    const hasInvoiceSuccess = auditLogs.some((log) => {
      const metadata = toMetadata(log.metadata);
      return (
        log.action === "agent.tool.invoice_register_supplier_invoice.executed" &&
        metadata?.idempotencyKey === invoiceInput.idempotencyKey
      );
    });

    const hasInvoiceError = auditLogs.some((log) => {
      const metadata = toMetadata(log.metadata);
      return (
        log.action === "agent.tool.invoice_register_supplier_invoice.executed.failed" &&
        metadata?.idempotencyKey === badInvoiceInput.idempotencyKey
      );
    });

    expect(hasExpenseSuccess).toBe(true);
    expect(hasExpenseError).toBe(true);
    expect(hasInvoiceSuccess).toBe(true);
    expect(hasInvoiceError).toBe(true);
  }, 45_000);
});

function toMetadata(value: unknown): { idempotencyKey?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const loose = value as Record<string, unknown>;
  return {
    idempotencyKey:
      typeof loose.idempotencyKey === "string" ? loose.idempotencyKey : undefined,
  };
}
