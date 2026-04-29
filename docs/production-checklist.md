# ConstructAI — Checklist de Producción

Versión: MVP · Fecha: 2026-04-25

---

## 1. Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | URL de conexión Supabase PostgreSQL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL pública de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (solo servidor) |
| `ANTHROPIC_API_KEY` | ✅ | API key de Anthropic para el agente IA |
| `AGENT_RATE_LIMIT_RPM` | opcional | RPM por (tenant, user) — default 20 |
| `NEXT_PUBLIC_APP_URL` | opcional | URL pública de la app para OG tags |

Regla: **ninguna de estas variables debe estar en código fuente ni en `.env` comiteado.**

---

## 2. Base de datos

- [ ] Todas las migraciones ejecutadas en orden: `20260425000000` → `20260425050000`
- [ ] `prisma generate` ejecutado contra el schema de producción
- [ ] RLS habilitado en Supabase para tablas expuestas al cliente
- [ ] Indices presentes (verificar con `\d+ table_name` en psql)
- [ ] Backup automático habilitado en Supabase (retención mínima 7 días)

---

## 3. Autenticación y sesiones

- [ ] Supabase Auth configurado con proveedores requeridos (email/password mínimo)
- [ ] Cookies: `httpOnly`, `secure`, `sameSite=lax` en producción
- [ ] JWT secret rotado y distinto al de staging
- [ ] Middleware de protección activo en `/dashboard/**` y `/api/**`

---

## 4. Multi-tenant

- [ ] Verificar que ningún endpoint retorna datos sin filtrar `tenant_id`
- [ ] Test: usuario de Tenant A intenta acceder a datos de Tenant B → 403 o 404
- [ ] `requireActiveTenant` usado en todos los endpoints con datos financieros
- [ ] `deletedAt: null` filtrado en todas las queries de entidades con soft-delete

---

## 5. Exportaciones

- [ ] Endpoint `/api/export` requiere sesión y permiso (`expense.manage` / `invoice.manage`)
- [ ] Rango máximo 366 días validado por Zod (no base de datos)
- [ ] Audit log generado en cada exportación (sin montos en el log)
- [ ] CSV no expone datos de otros tenants

---

## 6. Agente IA

- [ ] Rate limit 20 RPM por (tenant, user) activo
- [ ] Tokens de confirmación SHA-256 con TTL 10 min
- [ ] Audit log `ActorType.agent` en mutaciones del agente
- [ ] `anthropic("claude-3-5-haiku-20241022")` — verificar que el modelo esté disponible
- [ ] Sistema de confirmación probado end-to-end para `markInvoicePaid`

---

## 7. PWA / Offline

- [ ] `manifest.webmanifest` accesible en `/manifest.webmanifest`
- [ ] Iconos en `/icons/icon-192.svg` y `/icons/icon-512.svg`
- [ ] IndexedDB no almacena tokens, passwords ni datos bancarios
- [ ] Endpoint `/api/offline/sync` requiere sesión activa
- [ ] Dedup por `clientGeneratedId` funcionando (test idempotencia)

---

## 8. Observabilidad (pendiente configurar)

- [ ] **Sentry**: instalar `@sentry/nextjs` y configurar DSN para errores server + client
  - `SENTRY_DSN` en env vars
  - `sentry.server.config.ts` y `sentry.client.config.ts`
  - Source maps en builds de producción
- [ ] Logs estructurados en Vercel/servidor (no loggear tokens, XML, passwords)
- [ ] Alertas de tasa de error en dashboard de Sentry

---

## 9. Seguridad de red

- [ ] HTTPS obligatorio — Vercel lo provee en dominios `*.vercel.app`
- [ ] HSTS habilitado (Vercel: `Strict-Transport-Security` por defecto)
- [ ] Headers de seguridad en `next.config.js`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Content Security Policy (CSP) configurado — Supabase y Anthropic en allowlist

---

## 10. SAT / CFDI

- [ ] Certificados SAT almacenados cifrados (no en texto plano)
- [ ] `SatCredentialStatus.active` verificado antes de sync
- [ ] XML original almacenado en storage (no en base de datos)
- [ ] RFC del tenant configurado correctamente

---

## 11. Rate limiting

- [ ] Agente: 20 RPM por (tenant, user) — activo con sliding window
- [ ] Para producción multi-instancia: reemplazar `Map` en memoria por **Upstash Redis**
  - `lib/rate-limit.ts` requiere refactor con `@upstash/ratelimit`

---

## 12. Retención de datos

| Entidad | Retención |
|---|---|
| Audit logs financieros | Mínimo 5 años |
| Logs técnicos | 90-180 días |
| Conversaciones agente | 24 meses (configurable por tenant) |
| Borradores offline no sincronizados | 30 días |
| Backups | 30 días operativos + snapshots mensuales |

---

## 13. Checklist pre-deploy

```
[ ] npm run typecheck   → 0 errores
[ ] npm run lint        → 0 warnings
[ ] npm run build       → sin errores de compilación
[ ] npm test            → 36/36 tests passing
[ ] npx prisma validate → schema válido
[ ] Migración aplicada en staging y probada
[ ] Variables de entorno de producción configuradas
[ ] Dominio personalizado configurado en Vercel (si aplica)
[ ] DNS configurado y propagado
[ ] Primera cuenta de owner creada manualmente
```
