# Rotacion de clave SAT_CREDENTIALS_ENCRYPTION_KEY

## Proposito

`SAT_CREDENTIALS_ENCRYPTION_KEY` protege credenciales SAT en reposo (certificado, llave privada y password) mediante cifrado simetrico AES-GCM.

## Generar una clave nueva fuerte

- Requisito: usar un secreto aleatorio de alta entropia (minimo 32 bytes).
- Ejemplo seguro (sin exponer en logs ni terminal compartida):
  - `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
- Guardar la nueva clave en el gestor de secretos del entorno (no en repositorio).

## Pasos de rotacion

1. **Pre-check**
   - Confirmar build verde y estado estable de `/settings/sat`.
   - Verificar acceso al gestor de secretos y a base de datos.
   - Confirmar ventana de mantenimiento corta comunicada al equipo.
2. **Ventana de mantenimiento**
   - Congelar cambios que escriban credenciales SAT.
   - Evitar operaciones concurrentes de alta criticidad durante la rotacion.
3. **Backup**
   - Tomar backup consistente de la tabla `sat_credentials` antes de rotar.
   - Verificar que el backup sea recuperable.
4. **Despliegue de nueva clave**
   - Configurar `SAT_CREDENTIALS_ENCRYPTION_KEY` nueva en entorno.
   - Desplegar aplicacion con la nueva configuracion.
5. **Recuperacion y re-cifrado seguro**
   - Ejecutar script/operacion interna de re-cifrado: leer credenciales con clave anterior, descifrar en memoria, cifrar con clave nueva y persistir.
   - Procesar por lotes para reducir riesgo operativo.
   - No registrar payloads ni secretos durante el proceso.
6. **Verificacion**
   - Validar guardado/lectura normal desde `/settings/sat`.
   - Confirmar que registros historicos siguen siendo legibles con la clave nueva tras re-cifrado.

## Plan de rollback

- Mantener disponible la clave anterior hasta completar verificacion.
- Si falla la lectura o el re-cifrado:
  - Restaurar backup de `sat_credentials`.
  - Revertir variable de entorno a clave anterior.
  - Re-desplegar y validar flujo SAT.
- Registrar incidente y causa raiz antes de reintentar.

## Logs a revisar

- Logs de deploy/config para confirmar carga de entorno.
- Errores de servidor relacionados con cifrado/descifrado SAT.
- Alertas de excepciones en rutas SAT (sin secretos en mensajes).
- Auditoria de operaciones administrativas durante ventana.

## Checklist post-rotacion

- [ ] Nueva clave activa en todos los entornos requeridos.
- [ ] Re-cifrado completado sin errores pendientes.
- [ ] Flujo `/settings/sat` validado (guardar y leer).
- [ ] Monitoreo sin errores de cifrado por al menos 24 horas.
- [ ] Clave anterior retirada segun politica interna.
