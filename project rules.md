# ConstructAI .cursorrules

## Contexto del Proyecto

ConstructAI es un SaaS B2B para constructoras, arquitectos y desarrolladores inmobiliarios en México. Controla proyectos, contratos, presupuestos, facturas, CFDIs, pagos, gastos, proveedores, clientes, flujo de caja, reportes financieros y obligaciones fiscales.

El diferenciador principal es un agente de IA conversacional integrado al dashboard. El agente no es un chatbot genérico: puede consultar datos, registrar gastos, crear borradores, generar reportes, sincronizar CFDIs, conciliar facturas y ejecutar acciones reales con permisos, confirmaciones y audit log.

El producto es multi-tenant desde el inicio. Cada empresa es un tenant. Ninguna query, endpoint, job, tool del agente o reporte puede acceder a datos fuera del `tenant_id` autorizado.

## Stack Técnico Oficial

- Next.js 14.2.x con App Router.
- React 18.3.x.
- TypeScript 5.x con `strict: true`.
- Tailwind CSS 3.x.
- shadcn/ui.
- Supabase Auth.
- Supabase PostgreSQL 15+.
- Supabase Storage.
- Prisma 6.x.
- Zod para validación.
- React Hook Form para formularios.
- Zustand solo para estado local de UI.
- Vercel AI SDK 6.x para chat, streaming y tools.
- Redis/Upstash para rate limit, locks y colas ligeras.
- Sentry para errores.
- GitHub Actions para CI.
- PWA con IndexedDB solo para borradores offline seguros.

## Arquitectura General

Usar Next.js App Router con Route Handlers para APIs. Preferir Server Components para lectura de datos y Client Components solo cuando haya interacción, estado local, formularios o APIs del navegador.

La arquitectura mínima debe respetar:

- `app/` para rutas.
- `components/` para UI y componentes de dominio.
- `features/` para módulos funcionales.
- `lib/` para clientes, guards, utilidades y servicios compartidos.
- `server/` para lógica server-only.
- `prisma/` para schema y migraciones.
- `docs/` para documentación técnica.

Estructura obligatoria:

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ui/
  layout/
  agent/
features/
  projects/
  contracts/
  invoices/
  expenses/
  suppliers/
  clients/
  sat/
  reports/
  dashboard/
lib/
  auth/
  db/
  validations/
  permissions/
  audit/
  money/
  errors/
server/
  services/
  agent/
  jobs/
  sat/
prisma/
docs/
```

## Reglas de Nomenclatura

Archivos:

- Componentes React: `kebab-case.tsx`.
- Hooks: `use-*.ts`.
- Servicios server-only: `*.service.ts`.
- Validaciones Zod: `*.schema.ts`.
- Tipos compartidos: `*.types.ts`.
- Tests: `*.test.ts` o `*.spec.ts`.
- Route Handlers: `route.ts`.
- Server Actions: `actions.ts`.

Variables y funciones:

- Variables y funciones en `camelCase`.
- Componentes en `PascalCase`.
- Tipos e interfaces en `PascalCase`.
- Constantes globales en `SCREAMING_SNAKE_CASE`.
- Enums de base de datos en inglés y lowercase cuando sean valores persistidos.

Ejemplo:

```ts
const invoiceStatus = "pending_review";

type ProjectFinancialSummary = {
  projectId: string;
  committedCents: number;
  actualCents: number;
};
```

## Reglas de TypeScript

- `strict: true` obligatorio.
- Prohibido usar `any`.
- Prohibido `implicit any`.
- Usar `unknown` y narrowing cuando el tipo no sea conocido.
- Todos los endpoints deben validar input con Zod.
- Los schemas Zod deben ser la fuente de verdad para inputs externos.
- No duplicar tipos manualmente si pueden inferirse de Zod.

Correcto:

```ts
const createExpenseSchema = z.object({
  projectId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  description: z.string().min(3).max(500),
  totalCents: z.number().int().positive(),
  expenseDate: z.string().date(),
});

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
```

Incorrecto:

```ts
export async function POST(request: Request) {
  const body: any = await request.json();
}
```

## Reglas de Código

- Mantener funciones pequeñas.
- Separar controladores, servicios, validaciones y acceso a datos.
- No poner lógica de negocio compleja dentro de componentes React.
- No poner lógica financiera directamente en Route Handlers.
- No modificar archivos no relacionados con la tarea.
- No introducir dependencias sin justificación.
- No hacer refactors grandes sin autorización.

Patrón correcto de endpoint:

```ts
export async function POST(request: Request) {
  const session = await requireSession();
  const tenantId = await requireTenantId(session);

  const json = await request.json();
  const input = createExpenseSchema.parse(json);

  const result = await createExpense({
    tenantId,
    userId: session.user.id,
    input,
  });

  return Response.json(result);
}
```

## Manejo Obligatorio de Errores

- Usar errores de dominio.
- No exponer stack traces al cliente.
- Mapear errores conocidos a respuestas claras.
- Registrar errores técnicos en Sentry sin datos sensibles.
- Registrar intentos financieros en audit log cuando aplique.

Ejemplo:

```ts
try {
  return await registerPayment({ tenantId, userId, input });
} catch (error: unknown) {
  if (error instanceof DomainError) {
    return Response.json(
      { error: error.publicMessage },
      { status: error.statusCode },
    );
  }

  captureServerError(error, {
    module: "payments",
    tenantId,
    userId,
  });

  return Response.json(
    { error: "No pudimos procesar el pago. Intenta de nuevo o contacta soporte." },
    { status: 500 },
  );
}
```

## Comentarios

- Código, nombres de funciones, variables y tipos en inglés.
- Comentarios de lógica de negocio en español.
- No comentar lo obvio.
- Comentar reglas fiscales, reglas financieras o decisiones no triviales.

Ejemplo:

```ts
// En México los CFDIs deben conservarse por al menos 5 años para soporte fiscal.
const CFDI_RETENTION_YEARS = 5;
```

## Reglas de Seguridad

- Nunca exponer datos financieros sensibles en logs.
- Nunca loggear XML completo de CFDI.
- Nunca loggear certificados SAT, llaves privadas, passwords o tokens.
- Nunca exponer `service_role` al frontend.
- Nunca confiar en `tenant_id` enviado por el cliente.
- Siempre derivar `tenant_id` desde sesión y membership.
- Validar pertenencia al tenant antes de cualquier query.
- Sanitizar inputs del agente antes de ejecutar tools.
- Rate limiting obligatorio en endpoints del agente.
- Confirmar antes de ejecutar acciones irreversibles.
- Usar soft delete. Nunca hard delete en datos financieros.
- Usar transacciones para operaciones financieras.

Validación multi-tenant obligatoria:

```ts
const invoice = await prisma.invoice.findFirst({
  where: {
    id: invoiceId,
    tenantId,
    deletedAt: null,
  },
});

if (!invoice) {
  throw new NotFoundError("Factura no encontrada.");
}
```

Prohibido:

```ts
const invoice = await prisma.invoice.findUnique({
  where: { id: invoiceId },
});
```

## Reglas de Base de Datos

Toda tabla financiera debe tener:

- `id`
- `tenant_id`
- `created_at`
- `updated_at`
- `deleted_at`
- `created_by`
- `updated_by`

Reglas:

- Siempre filtrar por `tenant_id`.
- Siempre filtrar `deleted_at: null` salvo pantallas de auditoría.
- Usar transacciones para crear pagos, facturas, gastos, conciliaciones y ajustes.
- Guardar montos en centavos como enteros.
- Moneda por default: `MXN`.
- Nunca usar floats para dinero.
- Índices obligatorios para queries frecuentes.
- Constraints para montos positivos, pagos no mayores al total y UUID único de CFDI.
- RLS habilitado en tablas expuestas.

Ejemplo de transacción:

```ts
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.create({
    data: {
      tenantId,
      invoiceId,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      createdBy: userId,
    },
  });

  await tx.invoice.update({
    where: { id: invoiceId, tenantId },
    data: {
      paidCents: { increment: input.amountCents },
    },
  });

  await tx.auditLog.create({
    data: {
      tenantId,
      actorUserId: userId,
      actorType: "user",
      entityType: "payment",
      entityId: payment.id,
      action: "payment.created",
    },
  });
});
```

## Reglas del Agente IA

El agente debe responder en español claro, breve y accionable. Debe explicar qué encontró, qué puede hacer y qué necesita confirmar.

El agente puede:

- Consultar balances.
- Crear borradores.
- Registrar gastos.
- Registrar facturas.
- Generar reportes.
- Clasificar CFDIs.
- Crear recordatorios.
- Sugerir acciones.
- Preparar pagos para aprobación.

El agente nunca debe:

- Inventar datos financieros.
- Adivinar proyecto, proveedor, monto o fecha fiscal.
- Ejecutar pagos reales.
- Saltarse permisos.
- Acceder a otro tenant.
- Dar asesoría fiscal como verdad absoluta.
- Ocultar incertidumbre.
- Ejecutar acciones irreversibles sin confirmación.
- Mostrar secretos, tokens o certificados.
- Generar reportes con datos de otros tenants.

Formato interno de acción:

```ts
type AgentActionRequest = {
  toolName: string;
  tenantId: string;
  userId: string;
  input: unknown;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
};
```

Toda tool del agente debe tener:

- Zod input schema.
- Zod output schema.
- Permission guard.
- Tenant guard.
- Audit log.
- Error handling.
- Redacción de datos sensibles.

Ejemplo de tool:

```ts
export const createExpenseDraftTool = {
  name: "createExpenseDraft",
  inputSchema: createExpenseDraftSchema,
  async execute({ tenantId, userId, input }: ToolContext<CreateExpenseDraftInput>) {
    await assertPermission(userId, tenantId, "expense.create");

    return createExpenseDraft({
      tenantId,
      userId,
      input,
    });
  },
};
```

Manejo de ambigüedad:

- Si falta un campo crítico, preguntar.
- Si hay múltiples coincidencias, mostrar opciones.
- Si la confianza es menor a 0.8, no ejecutar.
- Si la acción impacta dinero, pedir confirmación.

Audit log del agente obligatorio:

```ts
await createAuditLog({
  tenantId,
  actorUserId: userId,
  actorType: "agent",
  entityType: "invoice",
  entityId: invoiceId,
  action: "agent.invoice.mark_paid.requested",
  beforeRedacted,
  afterRedacted,
});
```

## Reglas de SAT / CFDI

- Cifrar certificados, llaves privadas y passwords antes de guardar.
- No imprimir XML completo en logs.
- UUID de CFDI debe ser único por tenant.
- Guardar XML original en Storage.
- Guardar metadatos normalizados en Postgres.
- Parsear montos a centavos.
- Conciliar CFDIs contra proveedor, proyecto, gasto o factura.
- Si no hay confianza suficiente, marcar como `pending_review`.
- Alertar certificados próximos a vencer.
- Toda descarga SAT debe quedar en audit log.

## Reglas de UI/UX

Design system:

- Fondo: `#0B0F14`.
- Panel: `#111827`.
- Borde: `#1F2937`.
- Texto principal: `#F9FAFB`.
- Texto secundario: `#9CA3AF`.
- Acento: `#F59E0B`.
- Éxito: `#10B981`.
- Error: `#EF4444`.
- Riesgo: `#F97316`.

Usar shadcn/ui como base:

- `Button`
- `Card`
- `Table`
- `Dialog`
- `Sheet`
- `Form`
- `Input`
- `Select`
- `Badge`
- `Alert`
- `Tabs`
- `DropdownMenu`
- `Skeleton`
- `Sonner`

Estados obligatorios:

- Loading con skeleton.
- Empty state con acción sugerida.
- Error state con mensaje claro.
- Success state con confirmación.
- Disabled state cuando no hay permisos.

Accesibilidad mínima:

- Labels en inputs.
- Navegación por teclado.
- Contraste suficiente.
- `aria-label` en icon buttons.
- No depender solo del color para estados.
- Tablas financieras con encabezados claros.

## Reglas PWA

- Offline solo para borradores.
- No ejecutar acciones financieras finales offline.
- IndexedDB debe guardar cola de sincronización.
- Cada item offline debe tener `clientGeneratedId`.
- Validar todo nuevamente en servidor al sincronizar.
- Si hay conflicto, marcar como `needs_review`.
- No guardar secretos SAT ni tokens sensibles en IndexedDB.

## Reglas de Performance

- Evitar loops innecesarios.
- Minimizar queries.
- Preferir queries indexadas.
- Usar `Promise.all` para lecturas independientes.
- Evitar waterfalls en Server Components.
- Paginar tablas grandes.
- No cargar todos los CFDIs o facturas en memoria.
- Usar agregaciones SQL para KPIs financieros.
- Cachear catálogos seguros por tenant cuando aplique.

## Reglas de Git

Commits con Conventional Commits:

- `feat: add project budget lines`
- `fix: prevent cross-tenant invoice access`
- `refactor: extract payment service`
- `test: add tenant isolation tests`
- `docs: update SAT sync flow`

Branches:

- `feature/TASK-001-project-setup`
- `fix/TASK-021-invoice-tenant-guard`
- `chore/TASK-006-ci`

Nunca commitear:

- `.env`
- `.env.local`
- Certificados SAT.
- Llaves privadas.
- Dumps de base de datos.
- XMLs reales de CFDI.
- Tokens.
- Logs con datos financieros.
- Archivos temporales con información de clientes.
