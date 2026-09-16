---
type: red-team
date: 2026-09-08
status: applied-to-plan-decisions-confirmed
---

# Red-team del plan Editor v2

## Resultado

No recomendar implementación todavía. **12 ajustes propuestos: 1 crítico, 9 altos y 2 medios.**
Todos tienen evidencia estática en el código; no se han ejecutado tests, ataques, build ni llamadas a proveedores durante esta revisión.
Los escenarios son riesgos razonados a partir del flujo, no incidentes observados en producción.
Paulo aprobó aplicar los 12 ajustes con «ok» y después confirmó V1–V4. Incorporados en las seis fases y el log del plan; no se ha modificado código de aplicación.

## Alcance y metodología

- Plan leído completo: `../worktrees/habiteka-app-feat-editor-v2/plans/260908-0102-editor-v2/` respecto al checkout original.
- Evidencia de código: worktree `feat/editor-v2`, base `8f966e9`; no confundir con fixes sin commit del checkout original.
- Cuatro perspectivas: seguridad, fallos/recuperación, supuestos geométricos y contratos/complejidad.
- Tres lecturas delegadas y adjudicación/contratos por el principal. El revisor de supuestos había participado en el borrador: no se presenta como una revisión totalmente independiente del autor.
- El límite de hilos impidió crear un tercer revisor nuevo; se reutilizó el hilo del planner. No es modo ultra.
- Se excluyeron duplicados: falta genérica de CAS, aislamiento organizacional, snapshots y resultados tardíos ya están contemplados en el plan. Los hallazgos siguientes señalan contratos que faltan para cumplir esos requisitos.
- La revisión cubre brechas de planificación, no es una auditoría exhaustiva de seguridad de la aplicación.

## Hallazgos propuestos

### RT-01 — Transiciones de créditos no atómicas

- **Severidad:** Crítico. **Fases:** 5.
- **Evidencia:** `src/server/billing/credit-hold.ts:173`, `src/server/billing/credit-hold.ts:185`, `src/server/billing/credit-hold.ts:188`.
- **Escenario:** Dos devoluciones concurrentes pueden leer PENDING y aplicar ambas el abono; la clave única del job no serializa la transición del hold.
- **Ajuste propuesto:** Exigir bloqueo/CAS del hold antes de efectos dentro de la misma transacción. Probar revert/revert, expire/revert y settle/revert con concurrencia real en DB aislada, validando saldo y ledger.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-02 — Caducidad y recuperación no tienen un protocolo común

- **Severidad:** Alto. **Fases:** 5.
- **Evidencia:** `src/server/billing/credit-hold.ts:46`, `src/server/billing/credit-hold.ts:129`, `src/server/billing/credit-hold.ts:181`.
- **Escenario:** El proveedor puede completar tras caer el proceso; el hold vence y se devuelve antes de recuperar un resultado ya cobrado. El reaper existe, pero la búsqueda solo encontró definición y pruebas, no ejecución programada.
- **Ajuste propuesto:** Definir ejecutor, estados de resultado desconocido, política de expiración y reconciliación. No devolver automáticamente por reloj una operación enviada cuyo resultado se desconoce. Ensayar caídas antes/después del envío y recuperación después del TTL.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-03 — El último gesto puede perderse antes del guardado

- **Severidad:** Alto. **Fases:** 3, 5, 6.
- **Evidencia:** `src/components/canvas/canvas-workspace.tsx:214`, `src/components/canvas/canvas-workspace.tsx:221`, `src/components/canvas/canvas-workspace.tsx:225`.
- **Escenario:** El debounce actual se cancela al desmontar y no espera la promesa. CAS no protege una edición que nunca llegó al servidor.
- **Ajuste propuesto:** Elegir borrador durable por proyecto/zona o navegación bloqueada/confirmada hasta guardar. Cola serial y ACK asociado a versión local. Probar edición seguida de navegación inmediata, recarga offline y ACK antiguo.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-04 — El runner de tests no cierra las entradas alternativas

- **Severidad:** Alto. **Fases:** 1.
- **Evidencia:** `tests/helpers/db.ts:30`, `tests/helpers/db.ts:57`, `vitest.config.ts:7`, `src/server/db/prisma.ts:11`, `package.json:16`.
- **Escenario:** Un wrapper seguro puede pasar su gate mientras ejecución directa, watch o test:ci continúan alcanzando helpers destructivos sin guard.
- **Ajuste propuesto:** Proteger arranque y helper destructivo, no solo script nuevo. Verificar destino antes de conexión y marcador dentro de una conexión ya autorizada. Cubrir test, test:ci, watch y ejecución directa; nunca probar contra desarrollo.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-05 — Assets y revisiones nuevos fuera del ciclo de datos existente

- **Severidad:** Alto. **Fases:** 4, 5, 6.
- **Evidencia:** `src/server/privacy/deletion-service.ts:27`, `src/server/privacy/retention-job.ts:58`, `src/server/privacy/data-export.ts:23`.
- **Escenario:** Los servicios enumeran tipos de datos actuales; las nuevas imágenes/revisiones pueden quedar fuera de exportación o dejar binarios huérfanos. Un job tardío puede recrear contenido después del borrado.
- **Ajuste propuesto:** Integrar los nuevos datos en los tres servicios existentes y coordinar jobs con borrado. Gate importar/generar/exportar/suprimir, incluido resultado tardío y comprobación del inventario de assets.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-06 — La frontera de importación no especifica controles existentes

- **Severidad:** Alto. **Fases:** 4.
- **Evidencia:** `src/server/ai/image/input-sanitizer.ts:40`, `src/server/ai/image/input-sanitizer.ts:73`, `src/app/(app)/projects/[id]/_actions/agent-actions.ts:318`, `src/app/(app)/projects/[id]/_actions/agent-actions.ts:349`.
- **Escenario:** Una nueva acción podría aceptar bytes no acotados, assets ajenos o URL arbitraria y omitir consentimiento/ToS. El helper legacy de URL por prefijo no debe copiarse como control de confianza.
- **Ajuste propuesto:** Reutilizar sanitizer y gates existentes; bytes acotados o asset ID autorizado en servidor. Definir original visual saneado frente a binario original. Tests MIME falso, sobredimensión, asset ajeno, URL externa y consentimiento ausente.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-07 — Clave idempotente sin identidad completa de operación

- **Severidad:** Medio. **Fases:** 5.
- **Evidencia:** `src/server/billing/credit-hold.ts:53`, `src/server/billing/credit-hold.ts:86`, `src/server/billing/credit-hold.ts:97`.
- **Escenario:** El servicio devuelve un hold por clave global sin comparar organización/importe/referencia. Una clave reutilizada con otra revisión o modelo puede asociarse a una operación distinta.
- **Ajuste propuesto:** Derivar clave de facturación en servidor desde job autorizado; deduplicación acotada a organización y fingerprint inmutable. Misma clave con payload distinto devuelve conflicto sin proveedor ni transición de hold.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-08 — Dos puntos no corrigen una foto en perspectiva

- **Severidad:** Alto. **Fases:** 4, 6.
- **Evidencia:** `src/canvas/scale.ts:21`, `src/canvas/scale.ts:91`.
- **Escenario:** Una pared calibrada puede medir bien y el resto del plano permanecer deformado por perspectiva. Crop/rotación y escala uniforme no corrigen esto.
- **Ajuste propuesto:** Añadir comprobación con segunda medida transversal y tratamiento explícito de fotos oblicuas: rectificación como trabajo presupuestado, o referencia para trazado manual sin declarar métrica válida. La elección requiere validación de producto.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-09 — Aperturas sin contrato para cambios de topología

- **Severidad:** Alto. **Fases:** 2, 3.
- **Evidencia:** `src/lib/contracts/plano2d-payload.ts:35`, `src/canvas/plano-to-doc.ts:82`, `src/canvas/plano-to-doc.ts:90`.
- **Escenario:** Invertir/dividir/fusionar muros puede mover puertas o romper su anclaje. El adaptador actual convierte un hueco de paso en puerta.
- **Ajuste propuesto:** Conservar puerta/ventana/hueco y definir orientación/remapeo. Mantener centro y ancho físicos cuando sea representable; rechazar con explicación una operación inválida. Fixtures de inversión, división, fusión y hueco sin carpintería.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-10 — Recalibración después de amueblar sin semántica dimensional

- **Severidad:** Alto. **Fases:** 2, 4.
- **Evidencia:** `src/canvas/scale.ts:185`, `src/canvas/scale.ts:187`, `src/lib/plan-svg/rescale-plano.ts:29`.
- **Escenario:** Cambiar el factor global puede alterar un sofá introducido con medida física conocida; no acumular deriva no define qué debe conservarse.
- **Ajuste propuesto:** Exigir calibración antes de amueblar como base simple y especificar recalibración posterior controlada. Distinguir geometría derivada de imagen de dimensiones físicas explícitas; preview de cambios y confirmación.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-11 — Exportación prometida sin entregable definido

- **Severidad:** Medio. **Fases:** 2, 5, 6.
- **Evidencia:** `src/components/canvas/canvas-workspace.tsx:347`, `src/server/agent/canvas/rasterize-canvas-doc.ts:70`.
- **Escenario:** La descarga actual captura el primer canvas y el raster IA dibuja rectángulos; no equivalen a exportación arquitectónica con capas/cotas.
- **Ajuste propuesto:** Definir formato mínimo, módulo responsable y capas. Propuesta a validar: SVG métrico + PNG desde revisión confirmada, independientes de viewport/selección. No introducir PDF sin decisión explícita.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

### RT-12 — Convivencia legacy/v2 sin contrato de lectores y escritores

- **Severidad:** Alto. **Fases:** 2, 3, 5, 6.
- **Evidencia:** `src/server/actions/canvas.ts:23`, `src/server/actions/canvas.ts:48`, `src/server/db/scoped-repo.ts:205`, `src/app/share/[projectId]/page.tsx:23`.
- **Escenario:** Mantener rutas antiguas y añadir almacén/documento v2 no decide qué versión leen o escriben las acciones legacy. Pueden aparecer dos planos divergentes o compartir/exportar una revisión antigua.
- **Ajuste propuesto:** Fijar autoridad por proyecto/zona y política de compatibilidad: migrado implica legacy solo lectura o adaptador controlado, nunca dos escritores independientes. Enumerar consumidores y probar abrir legacy/v2, aplicar fondo, generar y compartir tras migración.
- **Disposición:** aceptado por Paulo y aplicado a requisitos/gates del plan; V1–V4 confirmadas. No implementado.

## Inventario mínimo de consumidores (RT-12)

La búsqueda de serializeCanvas/deserializeCanvas encontró siete módulos consumidores de producción y un archivo de pruebas, además del módulo que los define:

- `src/components/canvas/canvas-workspace.tsx:207` — editor/autoguardado.
- `src/server/actions/canvas.ts:20` — lectura, guardado y aplicación de fondo.
- `src/components/app/new-project-button.tsx:48` — plantilla inicial.
- `src/components/canvas/decor-suggestions-dialog.tsx:47` — recomendaciones.
- `src/components/canvas/generate-from-canvas-dialog.tsx:56` — generación.
- `src/app/share/[projectId]/page.tsx:41` — lector público legacy.
- `src/app/(app)/projects/[id]/_actions/agent-actions.ts:186` — acciones IA.
- `tests/canvas/serialize.test.ts:16` — round-trip y saneado.

No implica reescribir todos estos módulos ni reactivar el 3D. Implica documentar para cada uno adaptador, bloqueo explícito o lectura de snapshot, sin escrituras divergentes.

## Decisiones de la entrevista (histórico)

Resultado posterior confirmado con «ok»: autoguardado con recuperación local, rectificación asistida con comprobación de medidas, SVG+PNG y copia visual saneada sin binario original adicional. Las preguntas siguientes registran las alternativas que se evaluaron, no pendientes actuales.

1. Recomendado: autoguardado con borrador local recuperable y aviso claro de cambios pendientes; alternativa más simple, impedir/confirmar navegación hasta guardar. ¿Debe recuperarse trabajo al cerrar una pestaña sin conexión?
2. Fotos oblicuas: ¿rectificación asistida incluida ahora o trazado sobre referencia con advertencia de escala? No prometer medidas fiables con una única calibración.
3. Exportación inicial: propuesta SVG métrico y PNG con capas/cotas; confirmar si basta PNG.
4. Original: recomendado preservar apariencia mediante imagen saneada sin metadatos, no necesariamente el archivo binario intacto.

## Siguiente paso

V1–V4 registradas y propagadas, esfuerzo reestimado a 148–224 h orientativas, consistencia revisada. Siguiente paso: autorización de implementación de fase 1. La evidencia histórica de esta revisión sigue siendo estática; aplicar requisitos al plan no corrige todavía el código.
