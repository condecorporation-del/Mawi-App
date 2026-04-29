# Fase 4 - SAT / CFDI

Esta fase deja la arquitectura lista para integrar descarga SAT real, pero no depende de una cuenta final del cliente.

## Fallback controlado

- `MockSatDownloadClient` implementa el contrato de descarga SAT sin conectarse al SAT.
- El job guarda estados, request id mock, reintentos y errores igual que un cliente real.
- Cuando existan credenciales e infraestructura final, se reemplaza el adaptador por un cliente SAT real sin cambiar parser, persistencia, conciliacion ni reporte fiscal.

## Seguridad

- Certificado, llave privada y password se cifran con AES-256-GCM antes de persistir.
- La llave `SAT_CREDENTIAL_ENCRYPTION_KEY` debe ser base64 de 32 bytes.
- El audit log registra RFC y vigencia, pero nunca certificado, llave privada, password ni XML completo.
- Los XML se referencian por `xml_storage_path`; no se guardan como texto largo en base de datos.

## Pendientes antes de produccion SAT real

- Conectar un cliente SAT real al contrato `SatDownloadClient`.
- Guardar binarios XML en Supabase Storage privado.
- Ejecutar jobs programados con locks/reintentos distribuidos.
- Validar certificados reales contra SAT y alertar expiracion.
