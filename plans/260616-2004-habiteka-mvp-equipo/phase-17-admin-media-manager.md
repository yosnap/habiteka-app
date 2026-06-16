# F17 — Admin: Media Manager & StorageAdapter (Rol BE+FE)

## Context Links
- Plan general: [plan.md](plan.md) · Arquitectura: [docs/system-architecture.md](../../docs/system-architecture.md)
- Patrón de adaptador + sanitizado de imagen: [phase-03](phase-03-ia-adaptadores.md) (`input-sanitizer.ts`, anti-SSRF/bomb)
- BD base (metadatos): [phase-02](phase-02-be-datos-auth.md) · Shell/guard admin: [phase-15](phase-15-admin-shell-usuarios.md)

## Overview
- **Rol primario:** BE+FE (back-office)
- **Prioridad:** P2
- **Estado:** Planificado
- **Depende de:** F2 (metadatos en Postgres), F0 (patrón de adaptador/contratos), F15 (`requireAdmin`/`writeAudit`/shell). Reusa criterios de sanitizado de F3.
- **Paralela con:** F15, F16, F18
- **Descripción:** Media manager del back-office: subir imágenes al servidor por (1) **URL**, (2) **dispositivo** (upload), (3) elegir de **biblioteca** preconfigurada; organizar en **carpetas** (jerarquía). Storage abstraído tras un `StorageAdapter` (mismo patrón que adaptadores IA), impl S3-compatible: **S3 gestionado en producción (deploy oficial)** y **MinIO en self-host** (mismo adaptador, backend por env). Metadatos en Postgres (`MediaAsset`, `MediaFolder`).

## Key Insights
- **`StorageAdapter` como abstracción** (igual filosofía que `ChatVisionAdapter`/`ImageAdapter` de F3): desacopla el media manager del backend de storage. Vive en `src/server/storage/**` (nuevo, sin owner previo). Interfaz: `put/get/delete/list` + **presigned URLs** (upload directo de cliente + descarga temporal).
- **Storage de PRODUCCIÓN (deploy oficial) = S3 gestionado, NO MinIO single-node:** el despliegue oficial usa S3 gestionado (AWS S3 / R2 / equivalente) por durabilidad/HA/backup del proveedor — un MinIO de un solo nodo es un SPOF y sin backup. **MinIO sigue como opción self-host** (fair-code) tras el mismo `StorageAdapter` (S3-compatible) → cambiar de backend no toca el media manager. La elección de backend es por env, no por código.
- **Backup y cuota del bucket:** el bucket de producción tiene **backup/versionado** (gestionado por el proveedor o replicación; documentado en F11 `backup-dr.md`). Manejar **disco/cuota lleno**: `quota.ts` corta antes de llenar; presigned PUT con **límite de tamaño** (la URL firmada restringe content-length) para que un upload no desborde el bucket.
- **Subida por URL = riesgo SSRF** (el servidor fetchea una URL del usuario): validar destino (bloquear IPs privadas/loopback/metadata `169.254.169.254`, solo http/https, sin redirecciones a IP interna), límite de tamaño y timeout. Reusar criterios de `input-sanitizer` de F3 (magic bytes, dimensiones, strip EXIF, re-encode) — **DRY**: extraer/compartir esa validación, no duplicarla.
- **Upload de dispositivo:** preferir **presigned PUT** al storage (el archivo no pasa por el server Node) + validación post-upload (magic bytes/tamaño) antes de marcar el asset `ready`. El presigned PUT lleva **límite de content-length** (techo de tamaño en la propia URL firmada). Alternativa: stream con límite de tamaño.
- **Magic bytes ≠ extensión/MIME declarado:** validar el contenido real; strip EXIF (privacidad/geolocalización) y re-encode server-side.
- **Carpetas jerárquicas:** `MediaFolder` con `parentId` self-ref; evitar ciclos al mover.
- **Cuotas:** límite de tamaño total / nº de assets (config en `SystemSetting` de F16) → evita llenar el bucket.
- **Branding (F16) consume estos assets:** los logos referencian `MediaAsset.id`.

## Requirements
**Funcionales**
- `StorageAdapter` (interfaz + impl S3-compatible, sirve S3 gestionado y MinIO): `put`, `get`, `delete`, `list`, `getPresignedUploadUrl` (con límite content-length), `getPresignedDownloadUrl`.
- Subir por: URL (con validación anti-SSRF), dispositivo (presigned upload), biblioteca (reusar asset existente).
- Carpetas: crear/renombrar/mover/borrar; jerarquía con `parentId`; listar por carpeta.
- Validación de subida: magic bytes, tamaño máx, tipos permitidos (imágenes), strip EXIF, re-encode.
- Cuotas por límite configurable.
- Toda mutación: `requireAdmin()` + `writeAudit()`.

**No funcionales**
- Sin estado mutable por request en el adaptador (cliente S3 singleton-por-proceso).
- Credenciales de storage (`STORAGE_*`/`S3_*`) solo server-side; nunca al cliente (presigned URLs sí van al cliente, con expiración corta).
- **Producción = S3 gestionado** (durabilidad/HA/backup del proveedor); MinIO single-node solo para self-host (mismo adaptador S3-compatible).
- Archivos ≤200 líneas.

## Architecture
```
src/server/storage/
  storage-adapter.ts         # interfaz StorageAdapter (put/get/delete/list/presigned* con límite content-length)
  s3-storage-adapter.ts      # impl S3-compatible (cliente AWS SDK v3) — sirve a S3 gestionado (oficial) Y a MinIO (self-host); cliente singleton
  index.ts                   # getStorageAdapter() factory; backend por env (endpoint/region/credenciales)
src/server/admin/media/
  media.actions.ts           # CRUD assets (URL/upload/biblioteca) + writeAudit
  folder.actions.ts          # CRUD carpetas (parentId, anti-ciclo)
  url-import.ts              # fetch seguro por URL (anti-SSRF) + sanitizado
  upload-validator.ts        # magic bytes + tamaño + EXIF strip + re-encode (DRY con F3)
  quota.ts                   # comprueba cuota (lee SystemSetting de F16)
src/app/(admin)/media/page.tsx          # explorador (carpetas + grid de assets)
src/app/api/admin/media/upload/route.ts # presigned upload / confirm
```
**Data flow (upload dispositivo):** UI pide presigned URL → `media/upload` (`requireAdmin`) → `getPresignedUploadUrl` (límite content-length) → cliente sube directo al storage → confirm → `upload-validator` (magic bytes/tamaño) → `MediaAsset` `ready` + `writeAudit`. **URL import:** `url-import` valida destino (anti-SSRF) → fetch con límite/timeout → `upload-validator` → `put` en storage → `MediaAsset`. **Servir:** `getPresignedDownloadUrl` (expira).

## Related Code Files
**Crear (owner F17):** todo el árbol anterior, incl. `src/server/storage/**` (nuevo).
**Lee (no edita):** `src/server/admin/{guard,audit}.ts` (F15); `src/server/ai/image/input-sanitizer.ts` (F3) **solo si** F0/F3 lo exponen como utilidad compartida; si no, replicar criterios en `upload-validator.ts` sin editar F3.
**Requiere de F2 (propuestos, NO editar `prisma/**`):** modelos `MediaAsset`, `MediaFolder`.
**Sin solape:** NO toca `src/app/(app)/**`, `src/server/{ai,agent,db,billing}/**`, ni subrutas de F15/F16/F18. `src/app/api/admin/media/**` es exclusivo de F17 (F18 usa otras subrutas de `api/admin`).

## Implementation Steps
1. Proponer a F2 modelos `MediaFolder(id, name, parentId self-ref)` y `MediaAsset(id, folderId, key, url, mime, size, width, height, status, createdBy)`.
2. `storage-adapter.ts`: definir interfaz; `s3-storage-adapter.ts`: cliente S3-compatible singleton (sirve S3 gestionado y MinIO por endpoint), métodos + presigned URLs **con límite content-length**; `index.ts` factory (backend por env).
3. `upload-validator.ts`: magic bytes, tamaño, tipos, strip EXIF, re-encode (compartir criterios con F3, DRY).
4. `url-import.ts`: validar destino anti-SSRF (bloquear IP privada/loopback/metadata, solo http/https, sin redirección a interna), fetch con límite+timeout, luego validar.
5. `quota.ts`: leer límite de `SystemSetting` (F16) y bloquear si se excede.
6. `media.actions.ts` + `folder.actions.ts`: CRUD con `requireAdmin()` + `writeAudit()`; anti-ciclo al mover carpeta.
7. `api/admin/media/upload/route.ts`: emitir presigned + confirmar+validar.
8. UI explorador (carpetas/grid, subida por las 3 vías).
9. `pnpm typecheck` + `build` verdes.

## Todo List
- [ ] Modelos propuestos a F2 (`MediaAsset`/`MediaFolder`)
- [ ] `StorageAdapter` interfaz + impl S3-compatible (S3 gestionado prod / MinIO self-host) + presigned URLs (con límite content-length)
- [ ] `upload-validator` (magic bytes/tamaño/EXIF/re-encode, DRY con F3)
- [ ] `url-import` anti-SSRF (bloqueo IP interna/metadata, límite/timeout)
- [ ] Cuotas (lee SystemSetting)
- [ ] CRUD assets (URL/upload/biblioteca) + carpetas jerárquicas anti-ciclo
- [ ] Endpoint presigned upload + confirm/validate
- [ ] `writeAudit()` en mutaciones
- [ ] Tests TDD rojo→verde

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor):
- **anti-SSRF (unit):** `url-import` rechaza `http://169.254.169.254/...`, IP privada/loopback y redirección a IP interna; acepta URL pública válida. Rojo sin validación.
- **upload-validator (unit):** rechaza magic bytes inválidos, tamaño/dimensiones excesivos; strip EXIF en salida; acepta imagen válida re-encodeada.
- **presigned + confirm (integration, Postgres efímero, MinIO local como S3 de test):** flujo presigned→confirm crea `MediaAsset` `ready` solo tras validación; sin confirm queda pendiente; el presigned PUT rechaza un upload por encima del límite de content-length.
- **carpetas anti-ciclo:** mover una carpeta dentro de su descendiente → rechaza.
- **cuota:** superar el límite configurado → bloquea subida.
- **auditoría:** subir/borrar asset escribe `AuditLog`.
- **Mock:** se mockea MinIO (o local efímero) y el fetch de URL externa. NO se mockea el validator/anti-SSRF/Prisma (lógica propia + DB real).

## Success Criteria
- Subida por las 3 vías funciona; assets organizables en carpetas jerárquicas.
- URL maliciosa (IP interna/metadata) rechazada; archivo no-imagen rechazado por magic bytes.
- Presigned URLs expiran (con límite de content-length); credenciales de storage nunca llegan al cliente.
- Branding (F16) puede referenciar assets creados aquí.

## Risk Assessment
| Riesgo | Prob×Imp | Mitigación |
|---|---|---|
| SSRF vía import por URL | Med×Alto | `url-import`: bloquear IP privada/loopback/metadata, solo http/https, sin redirección interna, timeout/límite |
| Upload malicioso (no-imagen/bomb) | Med×Alto | `upload-validator`: magic bytes + dimensiones + re-encode; validar tras presigned confirm |
| EXIF con geolocalización filtrada | Med×Med | strip EXIF + re-encode server-side |
| Ciclo en jerarquía de carpetas | Baja×Med | validar que el destino no es descendiente al mover |
| Bucket lleno / disco lleno por abuso | Med×Med | `quota.ts` con límite configurable (SystemSetting) + presigned PUT con límite de content-length |
| SPOF/pérdida de assets (MinIO single-node sin backup) | Med×Alto | Producción = S3 gestionado (durabilidad/HA/backup del proveedor); MinIO single-node solo self-host; backup/versionado del bucket (F11) |
| Credenciales de storage filtradas al cliente | Baja×Crítico | solo presigned URLs al cliente; `STORAGE_*`/`S3_*` solo en `src/server/**` |
| Colisión `api/admin` con F18 | Baja×Med | F17 solo posee `api/admin/media/**`; F18 usa otras subrutas |

## Security Considerations
- Toda ruta/acción protegida por `requireAdmin()`; mutaciones auditadas.
- Anti-SSRF en import por URL; sanitizado de contenido (magic bytes, EXIF, re-encode) reutilizando criterios de F3 (DRY).
- `STORAGE_*`/`S3_*` solo server-side; presigned URLs con expiración corta y límite de content-length; descargas vía presigned (no exponer bucket público).
- Comentarios/nombres NO referencian nº de fase: explican el porqué (p.ej. "bloquear rango link-local previene SSRF a metadata del cloud").

## Next Steps
- F16 (branding) referencia `MediaAsset` para logos.
- F2 incorpora `MediaAsset`/`MediaFolder`. `src/server/storage/**` queda disponible como utilidad de plataforma.
