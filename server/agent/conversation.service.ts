import "server-only";

import { prisma } from "@/lib/db/prisma";

type AgentContext = { tenantId: string; userId: string; conversationId: string };
const TOOL_EXECUTION_PREFIX = "tool-exec:";
const TOOL_CONFIRMATION_PREFIX = "tool-confirmation:";
const TOOL_CONFIRMATION_USED_PREFIX = "tool-confirmation-used:";

export async function getOrCreateConversation(
  ctx: Pick<AgentContext, "tenantId" | "userId">,
  opts: { title?: string },
) {
  return prisma.conversation.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: opts.title,
    },
  });
}

export async function getConversationMessages(
  ctx: AgentContext,
  conversationId: string,
  limit = 30,
) {
  return prisma.message.findMany({
    where: { conversationId, tenantId: ctx.tenantId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function appendMessage(
  ctx: AgentContext,
  input: {
    conversationId: string;
    role: "user" | "assistant" | "tool";
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  return prisma.message.create({
    data: {
      conversationId: input.conversationId,
      tenantId: ctx.tenantId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}

type ToolExecutionStatus = "success" | "error";

export async function findToolExecutionByIdempotency(
  ctx: AgentContext,
  toolName: string,
  idempotencyKey: string,
) {
  const content = `${TOOL_EXECUTION_PREFIX}${toolName}:${idempotencyKey}`;
  return prisma.message.findFirst({
    where: {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      role: "tool",
      content,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordToolExecution(
  ctx: AgentContext,
  input: {
    toolName: string;
    idempotencyKey: string;
    status: ToolExecutionStatus;
    result?: unknown;
    error?: string;
  },
) {
  const content = `${TOOL_EXECUTION_PREFIX}${input.toolName}:${input.idempotencyKey}`;
  return appendMessage(ctx, {
    conversationId: ctx.conversationId,
    role: "tool",
    content,
    metadata: {
      toolName: input.toolName,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      result: input.result,
      error: input.error,
    },
  });
}

export async function createToolConfirmationRequest(
  ctx: AgentContext,
  input: {
    toolName: string;
    idempotencyKey: string;
    summary: string;
    payload: unknown;
  },
) {
  const confirmationToken = crypto.randomUUID();
  const content = `${TOOL_CONFIRMATION_PREFIX}${confirmationToken}`;
  await appendMessage(ctx, {
    conversationId: ctx.conversationId,
    role: "tool",
    content,
    metadata: {
      type: "confirmation_request",
      toolName: input.toolName,
      idempotencyKey: input.idempotencyKey,
      summary: input.summary,
      payload: input.payload,
      confirmationToken,
      createdAt: new Date().toISOString(),
    },
  });

  return confirmationToken;
}

export async function getToolConfirmationRequest(
  ctx: AgentContext,
  confirmationToken: string,
) {
  const content = `${TOOL_CONFIRMATION_PREFIX}${confirmationToken}`;
  return prisma.message.findFirst({
    where: {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      role: "tool",
      content,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markToolConfirmationAsUsed(
  ctx: AgentContext,
  confirmationToken: string,
) {
  const content = `${TOOL_CONFIRMATION_USED_PREFIX}${confirmationToken}`;
  return appendMessage(ctx, {
    conversationId: ctx.conversationId,
    role: "tool",
    content,
    metadata: {
      type: "confirmation_used",
      confirmationToken,
      usedAt: new Date().toISOString(),
    },
  });
}

export async function isToolConfirmationUsed(
  ctx: AgentContext,
  confirmationToken: string,
) {
  const content = `${TOOL_CONFIRMATION_USED_PREFIX}${confirmationToken}`;
  const row = await prisma.message.findFirst({
    where: {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      role: "tool",
      content,
    },
    select: { id: true },
  });

  return Boolean(row);
}

export async function getLatestPendingToolConfirmation(ctx: AgentContext) {
  const confirmationRows = await prisma.message.findMany({
    where: {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      role: "tool",
      content: { startsWith: TOOL_CONFIRMATION_PREFIX },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      content: true,
      metadata: true,
    },
  });

  for (const row of confirmationRows) {
    const token = row.content.replace(TOOL_CONFIRMATION_PREFIX, "");
    const alreadyUsed = await isToolConfirmationUsed(ctx, token);
    if (alreadyUsed) {
      continue;
    }

    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;

    if (!metadata) {
      continue;
    }

    return {
      confirmationToken: token,
      summary: typeof metadata.summary === "string" ? metadata.summary : "",
      toolName: typeof metadata.toolName === "string" ? metadata.toolName : "",
      idempotencyKey:
        typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey : "",
    };
  }

  return null;
}

export async function findTenantToolExecutionByIdempotency(
  tenantId: string,
  toolName: string,
  idempotencyKey: string,
) {
  const content = `${TOOL_EXECUTION_PREFIX}${toolName}:${idempotencyKey}`;
  return prisma.message.findFirst({
    where: {
      tenantId,
      role: "tool",
      content,
      metadata: {
        path: ["status"],
        equals: "success",
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
