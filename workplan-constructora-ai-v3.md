# Mawi AI — Workplan MVP

App de administración financiera para un ingeniero administrador de proyectos de construcción, con un agente de IA que ejecuta acciones reales en la base de datos por chat de texto o por voz. El dashboard sirve para ver lo que el agente hizo y el estado real del negocio.

---

## 1. Objetivo del producto

Un ingeniero administra varios proyectos de construcción y necesita saber en tiempo real cuánto ingresa, cuánto gasta, cuánto debe y cuánto le deben por proyecto. Hoy lo hace en Excel y WhatsApp. Esta app lo reemplaza con:

- Un dashboard que muestra el estado financiero real por proyecto.
- Un agente de IA que crea proyectos, registra gastos y facturas, consulta saldos y genera reportes cuando se le habla o escribe — desde la app o desde Telegram.

El agente no explica cómo hacer las cosas: las hace.

---

## 2. Alcance

### Sí incluye

- Proyectos: crear, listar, ver detalle, editar, archivar.
- Finanzas por proyecto: ingresos, gastos, presupuesto, utilidad bruta y neta.
- Facturas por cobrar y por pagar.
- Pagos asociados a facturas.
- Proveedores y clientes (nombre, RFC opcional, contacto).
- Agente operador con tool calling — todas las acciones importantes.
- Voz: nota de voz del usuario → transcripción → acción → respuesta hablada.
- Telegram: el ingeniero escribe o manda audio al bot y el agente responde y actúa.
- Historial de acciones del agente (audit log visible).
- Reportes generados por el agente, exportables a PDF.

### No incluye (fuera del MVP)

- SAT, CFDI, XML, conciliación fiscal — congelado indefinidamente.
- Multi-usuario con roles (residente, contador, cliente). Solo un perfil: administrador.
- Embeddings, pgvector, RAG, fine-tuning.
- PWA modo obra offline.
- Integraciones bancarias automáticas.
- WhatsApp Business API (se agrega después del MVP si se decide).

---

## 3. Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Auth + DB | Supabase Auth + PostgreSQL |
| ORM | Prisma 6 |
| UI | shadcn/ui + Tailwind CSS |
| Agente | Vercel AI SDK + Claude Sonnet (Anthropic) |
| Voz | Deepgram STT (nova-2, es-MX) + TTS (aura-asteria-es) |
| Telegram | Bot propio con webhook — recibe texto y audio, devuelve respuesta del agente |
| PDF | Librería ligera en servidor (ej. jsPDF o puppeteer) |
| Tests | Vitest |

---

## 4. Estado actual

### Funciona hoy

- Auth con Supabase, sesiones, guard de tenant, audit log.
- Esquema Prisma completo: Project, Invoice, Payment, Expense, Supplier, Client, Tenant, Membership, Conversation, Message, AuditLog.
- Dashboard con KPIs financieros, gráficas y alertas.
- UI de facturas por cobrar y por pagar.
- Registro de gastos y pagos.
- Proyectos: crear vía FAB, listar con KPIs, ver detalle en `/projects/[id]`.
- Agente: panel de chat, streaming, memoria de conversación, manejo de ambigüedad, banner de confirmación.
- Tools del agente activas: `get_project_balance`, `list_overdue_invoices`, `get_supplier_balance`, `create_expense_draft`, `register_supplier_invoice`.
- Rate limiting en el endpoint del agente.

### Pendiente de construir

- Editar proyecto desde la UI.
- Tools del agente: `create_project`, `list_projects`, `get_project_summary`, `register_income`, `mark_invoice_paid`, `update_project`, `generate_project_report`.
- Voz: captura de micrófono + Deepgram STT + Deepgram TTS.
- Telegram: bot con webhook que conecta al agente existente.
- Vista de historial de acciones del agente.
- Export PDF del reporte.

---

## 5. Fases

### Fase 1 — Agente operador completo (3–4 días)

El agente puede hacer todo el flujo del ingeniero desde chat de texto.

- Tool `create_project`: crea proyecto con nombre, código, presupuesto, cliente. Confirmación + idempotencia + audit log.
- Tool `update_project`: edita campos seguros (nombre, presupuesto, estado). Confirmación.
- Tool `list_projects`: devuelve proyectos activos con KPIs resumidos.
- Tool `get_project_summary`: ingresos, gastos, utilidad bruta y neta de un proyecto.
- Tool `register_income`: crea factura por cobrar ligada a un proyecto. Confirmación.
- Tool `mark_invoice_paid`: marca factura pagada y crea Payment. Confirmación.
- Tool `generate_project_report`: reporte estructurado (texto + tabla) por rango de fechas.
- UI: formulario de edición de proyecto (modal o página) accesible desde el detalle.

### Fase 2 — Voz bidireccional (2–3 días)

El ingeniero manda nota de voz, el agente actúa y responde hablando.

- Botón de micrófono en el panel del agente.
- Captura de audio en navegador (MediaRecorder, WebM/Opus).
- Endpoint `POST /api/agent/voice/transcribe` → Deepgram STT (nova-2, es-MX).
- Texto transcrito entra al mismo pipeline de chat existente.
- Endpoint `POST /api/agent/voice/speak` → Deepgram TTS (aura-asteria-es) → audio.
- Reproducción automática de la respuesta en el panel.
- Manejo de errores: micrófono bloqueado, audio vacío, confianza baja.

### Fase 3 — Telegram (2 días)

El ingeniero escribe o manda audio al bot de Telegram y el agente responde y actúa igual que en la app.

- Bot de Telegram con webhook en `/api/telegram/webhook`.
- Recibe mensajes de texto: pasa el texto al pipeline de chat del agente.
- Recibe mensajes de voz: descarga el audio de Telegram → Deepgram STT → pipeline de chat.
- Responde con el texto de la respuesta del agente.
- Un `conversationId` por usuario de Telegram — mantiene contexto entre mensajes.
- Seguridad: valida `X-Telegram-Bot-Api-Secret-Token` en el webhook.

### Fase 4 — Cierre y exportación (2 días)

- Vista "Historial de acciones" leyendo el audit log (solo acciones del agente).
- Export PDF del reporte generado por el agente.
- Smoke QA: flujo completo de texto, voz y Telegram. Checklist DoD.

---

## 6. Tools del agente

| Tool | Tipo | Descripción |
|------|------|-------------|
| `list_projects` | lectura | Proyectos del tenant con KPIs resumidos |
| `get_project_summary` | lectura | Ingresos, gastos, utilidad bruta y neta de un proyecto |
| `get_project_balance` | lectura | Saldo presupuestal vs ejecutado |
| `list_overdue_invoices` | lectura | Facturas vencidas (cobrar o pagar) |
| `get_supplier_balance` | lectura | Saldo pendiente por proveedor |
| `create_project` | mutación | Crea proyecto. Confirmación obligatoria |
| `update_project` | mutación | Edita campos seguros. Confirmación obligatoria |
| `create_expense_draft` | mutación | Registra gasto en revisión. Confirmación obligatoria |
| `register_supplier_invoice` | mutación | Crea factura por pagar. Confirmación obligatoria |
| `register_income` | mutación | Crea factura por cobrar. Confirmación obligatoria |
| `mark_invoice_paid` | mutación | Marca factura pagada + crea Payment. Confirmación obligatoria |
| `generate_project_report` | lectura | Reporte estructurado por proyecto y rango de fechas |

**Reglas para todas las mutaciones:** schema Zod de entrada y salida, `idempotencyKey` obligatorio, validación de pertenencia al tenant antes de mutar, audit log en éxito y en error, mensaje de error público sin filtrar internos.

---

## 7. Modelo de datos

El esquema Prisma actual cubre todo lo que necesita el MVP. No se agregan tablas nuevas.

Ajustes menores si no existen:
- `Project`: campo `archivedAt DateTime?` para soft-archive.
- `Expense` e `Invoice`: siempre con `projectId` cuando aplique.
- `AuditLog.actorType = agent` — ya existe, mantener.

---

## 8. Sobre n8n para el flujo del agente

**No usar n8n para el núcleo del agente.** El tool calling con Claude + Vercel AI SDK ya está construido y funciona. Añadir n8n como capa intermedia duplicaría la lógica, agregaría latencia y haría el debugging más difícil.

**Dónde sí tiene sentido n8n:** Si en el futuro se necesitan flujos programados (ej. "enviar reporte automático cada lunes", "alertar si una factura lleva 30 días sin pago"), n8n es una buena herramienta de orquestación para eso. No para el chat en tiempo real.

**Para Telegram:** se construye un webhook propio en Next.js (simple, ~50 líneas) que recibe el mensaje y lo pasa al pipeline del agente. No necesita n8n.

---

## 9. Criterios de aceptación del MVP

- El ingeniero crea un proyecto hablándole al agente: "Crea el proyecto Torre Azul con presupuesto de 2 millones". El agente confirma, lo crea y aparece en la lista.
- Clic en la tarjeta de un proyecto abre el detalle con números reales y opción de editar.
- El ingeniero manda una nota de voz: "registra un gasto de 25 mil en Torre Azul por cemento con CEMEX". El agente lo registra (con confirmación), responde hablando y el gasto aparece en la lista.
- El ingeniero escribe en Telegram: "¿cuánto llevo gastado en Torre Azul?". El agente responde con el número real.
- Cualquier acción del agente aparece en "Historial de acciones" con fecha, tipo y resultado.
- El ingeniero pide "dame el reporte de Torre Azul de este mes" y puede descargarlo en PDF.
- Ningún flujo del MVP depende de SAT, CFDI ni integración fiscal.
