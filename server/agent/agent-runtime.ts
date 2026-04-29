import "server-only";

import { readFileSync } from "fs";
import { join } from "path";

import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

import { agentToolRegistry } from "./tools/registry";
import { executeResolvedTool, ToolExecutionError } from "./tools/resolver";
import { buildTenantContext } from "./brain/tenant-context";

const domainKnowledge = readFileSync(
  join(process.cwd(), "server/agent/brain/domain-knowledge.md"),
  "utf-8",
);

export type AgentMessage = { role: "user" | "assistant"; content: string };

type AgentStreamInput = {
  ctx: { tenantId: string; userId: string; conversationId: string; confirmationToken?: string };
  tenantName: string;
  messages: AgentMessage[];
};

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";

const SYSTEM_PROMPT = `Eres el asistente financiero y operativo de la constructora {tenantName}.

Respondes SIEMPRE en español claro y directo.

Puedes hacer:
- Consultar saldos, facturas, gastos y estado de proyectos
- Crear proyectos y registrar gastos o ingresos (con confirmación del usuario)
- Marcar facturas como pagadas
- Generar resúmenes y reportes financieros por proyecto
- Alertar sobre facturas vencidas y desviaciones de presupuesto

No puedes:
- Inventar datos que no existen en el sistema
- Ejecutar acciones de escritura sin confirmación explícita del usuario
- Acceder a datos de otras empresas
- Dar asesoría fiscal definitiva`;

function toSafeToolId(toolName: string) {
  return toolName.replaceAll(".", "_");
}

function getSafeToolErrorMessage(error: unknown) {
  if (error instanceof ToolExecutionError) {
    return error.safeMessage;
  }
  return "No pude completar la consulta en este momento. Intenta de nuevo.";
}

export async function runAgentStream({ ctx, tenantName, messages }: AgentStreamInput) {
  const [basePrompt, tenantContext] = await Promise.all([
    Promise.resolve(SYSTEM_PROMPT.replace("{tenantName}", tenantName)),
    buildTenantContext(ctx.tenantId),
  ]);

  const systemPrompt = [basePrompt, domainKnowledge, tenantContext].join("\n\n---\n\n");

  const enabledTools = Object.fromEntries(
    agentToolRegistry.map((toolDef) => {
      const safeToolId = toSafeToolId(toolDef.name);
      return [
        safeToolId,
        tool({
          description: toolDef.description,
          parameters: toolDef.inputSchema as z.ZodTypeAny,
          async execute(input: unknown) {
            try {
              const result = await executeResolvedTool(ctx, toolDef.name, input);
              console.info(`[agent-tool] ok: ${toolDef.name}`);
              return result;
            } catch (error: unknown) {
              const safeMessage = getSafeToolErrorMessage(error);
              console.error(`[agent-tool] error: ${toolDef.name} — ${safeMessage}`);
              return { error: safeMessage };
            }
          },
        }),
      ];
    }),
  );

  const stream = streamText({
    model: anthropic(ANTHROPIC_MODEL),
    maxSteps: 5,
    system: `${systemPrompt}

---

## Herramientas disponibles — úsalas siempre en lugar de inventar datos

LECTURA (sin confirmación):
- project_list — lista proyectos con KPIs
- project_get_summary — resumen financiero completo de un proyecto
- finance_get_project_balance — balance presupuestal vs ejecutado
- project_generate_report — reporte detallado con gastos y facturas por rango de fechas
- finance_list_overdue_invoices — facturas vencidas
- finance_get_supplier_balance — saldo pendiente con proveedor

MUTACIONES (requieren confirmación explícita del usuario):
- project_create — crea proyecto
- project_update — edita proyecto
- expense_create_draft — registra gasto
- invoice_register_income — registra factura por cobrar
- invoice_register_supplier_invoice — registra factura por pagar
- invoice_mark_paid — marca factura pagada y crea pago

Reglas para mutaciones:
- Si la herramienta devuelve status="confirmation_required", pide confirmación explícita al usuario y espera.
- No ejecutes mutaciones sin confirmationToken vigente.
- Genera un idempotencyKey único por operación (ej: "{toolName}-{timestamp}").
- Si una herramienta devuelve { "error": "..." }, explica el error claramente y pide el dato faltante.`,
    messages,
    tools: enabledTools,
    maxTokens: 2048,
    temperature: 0.3,
  });

  return stream;
}
