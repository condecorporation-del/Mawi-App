# Mawi AI — Task Board

> Fuente de verdad del workplan: `workplan-constructora-ai-v3.md`
> Regla: `[x]` = hecho y usable hoy · `[ ]` = pendiente · `⏸` = fuera del MVP

---

## Estado general

| Fase | Descripción | Estado |
|------|-------------|--------|
| Fase 1 | Agente operador completo | 🟡 En progreso |
| Fase 2 | Voz bidireccional | ⬜ Pendiente |
| Fase 3 | Telegram | ⬜ Pendiente |
| Fase 4 | Cierre y exportación | ⬜ Pendiente |

---

## Lo que ya funciona (no tocar)

- [x] Auth con Supabase, sesiones, guard de tenant
- [x] Audit log base
- [x] Esquema Prisma completo (Project, Invoice, Payment, Expense, Supplier, Client, Tenant, Membership, Conversation, Message, AuditLog)
- [x] Dashboard con KPIs financieros, gráficas y alertas
- [x] UI de facturas por cobrar y por pagar
- [x] Registro de gastos y pagos
- [x] Proyectos: crear (FAB + formulario + Server Action), listar con KPIs, ver detalle `/projects/[id]`
- [x] Agente: panel de chat, streaming, memoria de conversación, manejo de ambigüedad
- [x] Banner de confirmación en el panel del agente
- [x] Tool: `get_project_balance`
- [x] Tool: `list_overdue_invoices`
- [x] Tool: `get_supplier_balance`
- [x] Tool: `create_expense_draft` (mutación con confirmación)
- [x] Tool: `register_supplier_invoice` (mutación con confirmación)
- [x] Rate limiting en `/api/agent/chat`

---

## Fase 1 — Agente operador completo

> El agente puede ejecutar el flujo completo del ingeniero desde texto.

| ID | Tarea | Estado |
|----|-------|--------|
| T-01 | Tool `create_project` — crea proyecto con nombre, código, presupuesto, cliente. Confirmación + idempotencia + audit log | [ ] |
| T-02 | Tool `update_project` — edita nombre, presupuesto, estado. Confirmación + audit log | [ ] |
| T-03 | Tool `list_projects` — devuelve proyectos activos del tenant con KPIs (presupuesto, gastado, por cobrar) | [ ] |
| T-04 | Tool `get_project_summary` — ingresos, gastos, utilidad bruta y neta de un proyecto | [ ] |
| T-05 | Tool `register_income` — crea factura por cobrar ligada a proyecto. Confirmación + audit log | [ ] |
| T-06 | Tool `mark_invoice_paid` — marca factura pagada y crea Payment. Confirmación + audit log | [ ] |
| T-07 | Tool `generate_project_report` — reporte texto + tabla por rango de fechas | [ ] |
| T-08 | UI: formulario de edición de proyecto (modal desde `/projects/[id]`) — nombre, presupuesto, estado, cliente | [ ] |

---

## Fase 2 — Voz bidireccional

> El ingeniero manda nota de voz, el agente actúa y responde hablando.

| ID | Tarea | Estado |
|----|-------|--------|
| T-09 | Botón de micrófono en `AgentInput` — captura audio con MediaRecorder (WebM/Opus) | [ ] |
| T-10 | Endpoint `POST /api/agent/voice/transcribe` — reenvía audio a Deepgram STT (nova-2, es-MX), devuelve texto | [ ] |
| T-11 | Conectar transcripción al pipeline de chat existente — el texto transcrito entra como mensaje del usuario | [ ] |
| T-12 | Endpoint `POST /api/agent/voice/speak` — recibe texto, llama Deepgram TTS (aura-asteria-es), devuelve audio | [ ] |
| T-13 | Reproducción automática de la respuesta de voz en el panel tras cada turno del agente | [ ] |
| T-14 | Manejo de errores de voz: micrófono bloqueado, audio vacío, confianza baja de Deepgram | [ ] |

---

## Fase 3 — Telegram

> El ingeniero escribe o manda audio desde Telegram y el agente responde y actúa igual que en la app.

| ID | Tarea | Estado |
|----|-------|--------|
| T-15 | Bot de Telegram — registrar bot en BotFather, configurar webhook en `/api/telegram/webhook` | [ ] |
| T-16 | Recibir mensajes de texto de Telegram — pasar al pipeline del agente, responder con el resultado | [ ] |
| T-17 | Recibir mensajes de voz de Telegram — descargar audio → Deepgram STT → pipeline del agente → responder | [ ] |
| T-18 | Persistencia de `conversationId` por usuario de Telegram — el agente mantiene contexto entre mensajes | [ ] |
| T-19 | Seguridad del webhook — validar `X-Telegram-Bot-Api-Secret-Token` en cada request | [ ] |

---

## Fase 4 — Cierre y exportación

| ID | Tarea | Estado |
|----|-------|--------|
| T-20 | Vista "Historial de acciones" — lista paginada del audit log filtrando `actorType = agent` | [ ] |
| T-21 | Export PDF — el reporte generado por `generate_project_report` se puede descargar como PDF | [ ] |
| T-22 | Smoke QA — flujo completo: texto, voz, Telegram. Verificar checklist de criterios de aceptación del workplan | [ ] |

---

## Fuera del MVP (no priorizar)

- ⏸ SAT / CFDI / descarga fiscal — congelado
- ⏸ PWA offline modo obra — congelado
- ⏸ Embeddings / RAG — congelado
- ⏸ WhatsApp Business API — evaluar después del MVP
- ⏸ Multi-usuario con roles (residente, contador) — después del MVP
- ⏸ Integraciones bancarias automáticas — después del MVP
- ⏸ n8n para flujo del agente en tiempo real — no aplica (ver workplan sección 8)
