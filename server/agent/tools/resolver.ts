import { z } from "zod";
import { ActorType } from "@prisma/client";

import { createAuditLog } from "@/server/services/audit.service";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { DomainError } from "@/lib/errors/domain-error";
import {
  createToolConfirmationRequest,
  findToolExecutionByIdempotency,
  findTenantToolExecutionByIdempotency,
  getToolConfirmationRequest,
  isToolConfirmationUsed,
  markToolConfirmationAsUsed,
  recordToolExecution,
} from "@/server/agent/conversation.service";
import { agentToolRegistry } from "./registry";
import type { ToolExecutionContext } from "./types";

type RegisteredTool = (typeof agentToolRegistry)[number];

export function resolveToolByName(toolName: string): RegisteredTool | null {
  return (
    agentToolRegistry.find((tool) => tool.name === toolName) ?? null
  );
}

export class ToolExecutionError extends Error {
  constructor(public readonly safeMessage: string) {
    super(safeMessage);
    this.name = "ToolExecutionError";
  }
}

export async function executeResolvedTool(
  context: ToolExecutionContext,
  toolName: string,
  rawInput: unknown,
): Promise<unknown> {
  const tool = resolveToolByName(toolName);

  if (!tool) {
    throw new Error(`Tool no encontrada: ${toolName}`);
  }

  return executeTool(tool, context, rawInput);
}

async function executeTool(
  tool: RegisteredTool,
  context: ToolExecutionContext,
  rawInput: unknown,
) {
  try {
    for (const permission of tool.requiredPermissions) {
      await assertPermission(context.userId, context.tenantId, permission);
    }

    const parsedInput = tool.inputSchema.parse(rawInput);
    const idempotencyKey = getIdempotencyKey(parsedInput);

    if (tool.requiresConfirmation && !idempotencyKey) {
      throw new ToolExecutionError(
        "La operacion requiere un idempotencyKey valido para evitar duplicados.",
      );
    }

    if (idempotencyKey) {
      const existingExecution = await (tool.name === "invoice.register_supplier_invoice"
        ? findTenantToolExecutionByIdempotency(context.tenantId, tool.name, idempotencyKey)
        : findToolExecutionByIdempotency(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          conversationId: context.conversationId,
        },
        tool.name,
        idempotencyKey,
      ));

      const existingMetadata = parseRecordMetadata(existingExecution?.metadata);
      if (existingMetadata?.status === "success" && existingMetadata.result) {
        await createAuditLog({
          tenantId: context.tenantId,
          actorUserId: context.userId,
          actorType: ActorType.agent,
          entityType: "agent_tool",
          entityId: tool.name,
          action: `${tool.auditEvent}.idempotent_hit`,
          metadata: {
            toolName: tool.name,
            version: tool.version,
            status: "idempotent_hit",
            idempotencyKey,
            requiredPermissions: tool.requiredPermissions,
          },
        });
        return tool.outputSchema.parse(existingMetadata.result);
      }
    }

    if (tool.requiresConfirmation) {
      const validConfirmation = await getValidConfirmationOrNull(
        context,
        tool.name,
        idempotencyKey!,
      );

      if (!validConfirmation) {
        const summary = buildConfirmationSummary(tool.name, parsedInput);
        const confirmationToken = await createToolConfirmationRequest(
          {
            tenantId: context.tenantId,
            userId: context.userId,
            conversationId: context.conversationId,
          },
          {
            toolName: tool.name,
            idempotencyKey: idempotencyKey!,
            summary,
            payload: parsedInput,
          },
        );

        await createAuditLog({
          tenantId: context.tenantId,
          actorUserId: context.userId,
          actorType: ActorType.agent,
          entityType: "agent_tool",
          entityId: tool.name,
          action: `${tool.auditEvent}.confirmation_required`,
          metadata: {
            toolName: tool.name,
            version: tool.version,
            status: "confirmation_required",
            idempotencyKey,
            requiredPermissions: tool.requiredPermissions,
          },
        });

        return tool.outputSchema.parse({
          status: "confirmation_required",
          summary,
          confirmationToken,
        });
      }
    }

    if (tool.requiresConfirmation && context.confirmationToken) {
      await markToolConfirmationAsUsed(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          conversationId: context.conversationId,
        },
        context.confirmationToken,
      );
    }

    const executeFn = tool.execute as (
      context: ToolExecutionContext,
      input: unknown,
    ) => Promise<unknown> | unknown;
    const rawOutput = await executeFn(context, parsedInput);
    const output = tool.outputSchema.parse(rawOutput);

    if (idempotencyKey) {
      await recordToolExecution(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          conversationId: context.conversationId,
        },
        {
          toolName: tool.name,
          idempotencyKey,
          status: "success",
          result: output,
        },
      );
    }

    await createAuditLog({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      actorType: ActorType.agent,
      entityType: "agent_tool",
      entityId: tool.name,
      action: tool.auditEvent,
      metadata: {
        toolName: tool.name,
        version: tool.version,
        status: "success",
        idempotencyKey,
        requiredPermissions: tool.requiredPermissions,
      },
    });

    return output;
  } catch (error) {
    const parsedInputForError = getLooseObject(rawInput);
    const idempotencyKeyForError =
      typeof parsedInputForError?.idempotencyKey === "string"
        ? parsedInputForError.idempotencyKey
        : undefined;

    if (idempotencyKeyForError) {
      await recordToolExecution(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          conversationId: context.conversationId,
        },
        {
          toolName: tool.name,
          idempotencyKey: idempotencyKeyForError,
          status: "error",
          error:
            error instanceof DomainError
              ? error.publicMessage
              : "No pude ejecutar la consulta solicitada.",
        },
      );
    }

    await createAuditLog({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      actorType: ActorType.agent,
      entityType: "agent_tool",
      entityId: tool.name,
      action: `${tool.auditEvent}.failed`,
      metadata: {
        toolName: tool.name,
        version: tool.version,
        status: "error",
        idempotencyKey: idempotencyKeyForError,
        requiredPermissions: tool.requiredPermissions,
      },
    });

    if (error instanceof z.ZodError) {
      throw new ToolExecutionError(
        "No pude ejecutar la consulta porque faltan datos o el formato es invalido.",
      );
    }

    if (error instanceof DomainError) {
      throw new ToolExecutionError(error.publicMessage);
    }

    throw new ToolExecutionError("No pude ejecutar la consulta solicitada.");
  }
}

function getLooseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getIdempotencyKey(parsedInput: unknown): string | null {
  const loose = getLooseObject(parsedInput);
  const value = loose?.idempotencyKey;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseRecordMetadata(metadata: unknown) {
  const loose = getLooseObject(metadata);
  if (!loose) return null;

  return {
    status: loose.status,
    result: loose.result,
  };
}

function buildConfirmationSummary(toolName: string, parsedInput: unknown) {
  const normalizedInput = getLooseObject(parsedInput) ?? {};
  const withoutIdempotency = { ...normalizedInput };
  delete withoutIdempotency.idempotencyKey;

  return `Confirma la accion ${toolName} con los datos: ${JSON.stringify(withoutIdempotency)}`;
}

async function getValidConfirmationOrNull(
  context: ToolExecutionContext,
  toolName: string,
  idempotencyKey: string,
) {
  if (!context.confirmationToken) {
    return null;
  }

  const record = await getToolConfirmationRequest(
    {
      tenantId: context.tenantId,
      userId: context.userId,
      conversationId: context.conversationId,
    },
    context.confirmationToken,
  );

  const alreadyUsed = await isToolConfirmationUsed(
    {
      tenantId: context.tenantId,
      userId: context.userId,
      conversationId: context.conversationId,
    },
    context.confirmationToken,
  );

  if (alreadyUsed) {
    return null;
  }

  const metadata = getLooseObject(record?.metadata);
  if (!metadata) {
    return null;
  }

  if (metadata.toolName !== toolName) {
    return null;
  }

  if (metadata.idempotencyKey !== idempotencyKey) {
    return null;
  }

  return metadata;
}

export const availableAgentTools = agentToolRegistry.map((tool) => ({
  name: tool.name,
  description: tool.description,
  riskLevel: tool.riskLevel,
  requiredPermissions: tool.requiredPermissions,
  requiresConfirmation: tool.requiresConfirmation,
  auditEvent: tool.auditEvent,
  version: tool.version,
}));

export const availableAgentToolsSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    riskLevel: z.enum(["low", "medium", "high"]),
    requiredPermissions: z.array(z.string()),
    requiresConfirmation: z.boolean(),
    auditEvent: z.string(),
    version: z.string(),
  }),
);
