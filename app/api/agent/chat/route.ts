import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { chatRequestSchema } from "@/features/agent/conversation.schema";
import { getCurrentSession } from "@/lib/auth/session";
import { requireActiveTenant } from "@/lib/auth/tenant";
import { assertPermission } from "@/lib/permissions/assert-permission";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";
import {
  getOrCreateConversation,
  getConversationMessages,
  appendMessage,
  getLatestPendingToolConfirmation,
} from "@/server/agent/conversation.service";
import { runAgentStream } from "@/server/agent/agent-runtime";
import { checkForAmbiguity } from "@/server/agent/ambiguity.service";
import type { AgentMessage } from "@/server/agent/agent-runtime";

const RATE_LIMIT_RPM = Number(process.env.AGENT_RATE_LIMIT_RPM ?? "20");
const conversationIdQuerySchema = z.object({
  conversationId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const membership = await requireActiveTenant(session.user.id).catch(() => null);
  if (!membership) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 403 });
  }

  await assertPermission(session.user.id, membership.tenantId, "agent.chat");

  const paramsResult = conversationIdQuerySchema.safeParse({
    conversationId: req.nextUrl.searchParams.get("conversationId"),
  });

  if (!paramsResult.success) {
    return NextResponse.json({ error: "conversationId invalido." }, { status: 422 });
  }

  const conversationId = paramsResult.data.conversationId;
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: membership.tenantId,
      userId: session.user.id,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada." }, { status: 404 });
  }

  const pendingConfirmation = await getLatestPendingToolConfirmation({
    tenantId: membership.tenantId,
    userId: session.user.id,
    conversationId,
  });

  return NextResponse.json({
    conversationId,
    pendingConfirmation,
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const membership = await requireActiveTenant(session.user.id).catch(() => null);
  if (!membership) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 403 });
  }

  await assertPermission(session.user.id, membership.tenantId, "agent.chat");

  const rateLimitKey = `agent:${membership.tenantId}:${session.user.id}`;
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_RPM);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", details: parsed.error.issues },
      { status: 422 },
    );
  }

  const { message, conversationId: existingConvId, confirmationToken } = parsed.data;

  const ctx = {
    tenantId: membership.tenantId,
    userId: session.user.id,
    conversationId: "",
    confirmationToken,
  };

  let convId = existingConvId;
  if (!convId) {
    const conv = await getOrCreateConversation(ctx, { title: message.slice(0, 80) });
    convId = conv.id;
  }
  ctx.conversationId = convId;

  const ambiguity = checkForAmbiguity(message);
  if (ambiguity.ambiguous) {
    await appendMessage(ctx, {
      conversationId: convId,
      role: "user",
      content: message,
    });
    const clarificationText = ambiguity.clarification;
    await appendMessage(ctx, {
      conversationId: convId,
      role: "assistant",
      content: clarificationText,
    });

    return NextResponse.json({
      conversationId: convId,
      type: "clarification",
      message: clarificationText,
    });
  }

  const history = await getConversationMessages(ctx, convId, 30);
  const messages: AgentMessage[] = [
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  await appendMessage(ctx, { conversationId: convId, role: "user", content: message });

  try {
    const stream = await runAgentStream({
      ctx,
      tenantName: membership.tenant.name,
      messages,
    });

    const response = stream.toTextStreamResponse();

    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", convId);

    return new Response(response.body, { headers, status: response.status });
  } catch (error) {
    console.error("[agent/chat] stream error:", error);
    return NextResponse.json(
      { error: "No pude generar respuesta del agente en este momento." },
      { status: 502, headers: { "X-Conversation-Id": convId } },
    );
  }
}
