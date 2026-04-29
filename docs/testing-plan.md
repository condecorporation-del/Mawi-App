# ConstructAI — Plan de Pruebas (Smoke Tests MVP)

Versión: MVP · Fecha: 2026-04-25

---

## Smoke Tests Obligatorios

Los siguientes tests deben ejecutarse manualmente antes de cada deploy a producción.

---

### ST-001 — Autenticación: Login → Dashboard protegido

**Precondición:** App corriendo, usuario existente en Supabase Auth.

**Pasos:**
1. Acceder a `/login` sin sesión activa.
2. Ingresar credenciales válidas y hacer submit.
3. Verificar redirección a `/dashboard`.
4. Acceder a `/dashboard` sin sesión → verificar redirección a `/login`.

**Resultado esperado:** ✅ Login redirige a dashboard. Sin sesión redirige a login.

---

### ST-002 — Multi-tenant: Aislamiento de datos

**Precondición:** Dos tenants distintos con datos propios (Tenant A y Tenant B).

**Pasos:**
1. Autenticarse como usuario del Tenant A.
2. Intentar acceder a `/api/export?type=expenses&from=2026-01-01&to=2026-04-30` — verificar que solo retorna datos de Tenant A.
3. Intentar acceder a recursos de Tenant B modificando IDs en query params.
4. Verificar que la respuesta es 403 o 404 consistente.

**Resultado esperado:** ✅ Nunca se exponen datos de Tenant B a usuario de Tenant A.

---

### ST-003 — Export: Rango válido genera archivo CSV

**Precondición:** Usuario autenticado con permiso `expense.manage` o `invoice.manage`.

**Pasos:**
1. Navegar a `/expenses`.
2. Hacer click en "Exportar CSV".
3. Verificar que el navegador descarga un archivo `.csv`.
4. Abrir el CSV y verificar que contiene encabezados correctos y datos del mes actual.

**Resultado esperado:** ✅ Archivo CSV descargado con columnas: `fecha, proyecto, proveedor, partida_presupuestal, descripcion, estado, fuente, moneda, total`.

---

### ST-004 — Export: Rango inválido retorna error Zod

**Precondición:** Usuario autenticado.

**Pasos:**
1. Hacer GET a `/api/export?type=expenses&from=2026-04-30&to=2026-01-01` (fecha fin antes de inicio).
2. Verificar respuesta HTTP 422 con mensaje de error descriptivo.
3. Hacer GET a `/api/export?type=expenses&from=2026-01-01&to=2027-06-01` (rango > 366 días).
4. Verificar respuesta HTTP 422 con mensaje sobre el límite.

**Resultado esperado:** ✅ HTTP 422 con `{ error: "Parámetros inválidos.", details: [...] }`.

---

### ST-005 — Permisos: Rol sin permiso no puede exportar

**Precondición:** Usuario con rol `viewer` autenticado.

**Pasos:**
1. Autenticarse como usuario con rol `viewer`.
2. Hacer GET a `/api/export?type=expenses&from=2026-01-01&to=2026-04-30`.
3. Verificar respuesta HTTP 403.

**Resultado esperado:** ✅ HTTP 403 con mensaje de autorización denegada.

---

### ST-006 — Auditoría: Export genera audit log

**Precondición:** Usuario autenticado con permiso, acceso a tabla `audit_logs`.

**Pasos:**
1. Exportar cualquier reporte (ST-003).
2. Consultar `audit_logs` donde `entity_type = 'export'` y `action = 'export.csv'`.
3. Verificar que existe un registro con `actor_user_id` correcto y metadata `{ type, from, to, rowCount }`.
4. Verificar que el log NO contiene montos ni datos financieros detallados.

**Resultado esperado:** ✅ Registro en `audit_logs` con metadata de tipo/periodo/rowCount, sin datos sensibles.

---

### ST-007 — Agente IA: Conversación básica

**Precondición:** `ANTHROPIC_API_KEY` configurada, usuario con permiso `agent.chat`.

**Pasos:**
1. Abrir el panel del agente (botón flotante).
2. Preguntar: "¿Cuántos proyectos activos hay?".
3. Verificar que el agente responde con información coherente (o dice que no hay datos).
4. Verificar que la respuesta llega via streaming (texto aparece progresivamente).

**Resultado esperado:** ✅ Respuesta coherente vía streaming sin errores en consola.

---

### ST-008 — Offline: Borrador de gasto se guarda en IndexedDB

**Precondición:** Navegador con soporte de IndexedDB, `OfflineExpenseForm` renderizado.

**Pasos:**
1. Abrir DevTools → Network → poner "Offline".
2. Completar formulario de gasto offline con descripción, monto y fecha.
3. Hacer submit.
4. Verificar mensaje "Borrador guardado. Se sincronizará al reconectarse."
5. En DevTools → Application → IndexedDB → `constructai-offline` → verificar el registro.
6. Reconectar network.
7. Verificar que al volver a hacer submit (o al recargar), el borrador se sincroniza.

**Resultado esperado:** ✅ Draft guardado en IndexedDB offline, sincronizado al reconectar.

---

### ST-009 — SAT: Credenciales no se loggean

**Precondición:** Módulo SAT activo.

**Pasos:**
1. Ejecutar un sync SAT y revisar los logs del servidor.
2. Verificar que no aparecen tokens, certificados, XML, ni passwords en ningún log.

**Resultado esperado:** ✅ Logs limpios, solo metadata de sync (estado, timestamp, conteos).

---

### ST-010 — Rate limit: Agente rechaza solicitudes excesivas

**Precondición:** `AGENT_RATE_LIMIT_RPM=5` configurado para la prueba.

**Pasos:**
1. Enviar 6+ mensajes rápidos al agente en menos de 60 segundos.
2. Verificar que la respuesta 6+ retorna HTTP 429 con header `Retry-After`.

**Resultado esperado:** ✅ HTTP 429 en el 6to mensaje con tiempo de espera en `Retry-After`.

---

## Matriz de Resultados

| Test | Descripción | Estado | Observaciones |
|------|------------|--------|---------------|
| ST-001 | Auth login/logout | ⬜ pendiente | |
| ST-002 | Multi-tenant aislamiento | ⬜ pendiente | |
| ST-003 | Export CSV válido | ⬜ pendiente | |
| ST-004 | Export rango inválido | ⬜ pendiente | |
| ST-005 | Permisos export | ⬜ pendiente | |
| ST-006 | Audit log export | ⬜ pendiente | |
| ST-007 | Agente IA streaming | ⬜ pendiente | |
| ST-008 | Offline IndexedDB | ⬜ pendiente | |
| ST-009 | SAT logs seguros | ⬜ pendiente | |
| ST-010 | Rate limit agente | ⬜ pendiente | |

---

## Tests Automatizados (Vitest)

Ejecutar antes de cada PR:
```bash
npm test
# Esperado: 18 archivos, 36 tests, 0 failures
```

Cobertura mínima requerida para módulos financieros:
- `export.service.ts` — cubrir casos de rango inválido y tenant isolation
- `offline-sync.service.ts` — cubrir dedup por clientGeneratedId
- `audit.service.ts` — cubrir redacción de datos sensibles

---

## Backlog de Tests Automatizados

Los siguientes tests deben escribirse en Fase 8 (post-MVP):

- [ ] `export.service.test.ts` — unit test CSV generation + row limits
- [ ] `offline-sync.service.test.ts` — idempotency, needs_review cases
- [ ] `export route` — integration test con tenant isolation
- [ ] E2E con Playwright: ST-001 a ST-006
