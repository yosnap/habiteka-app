# Proyecto multi-zona con historial imagen→diseño

**Tipo:** rediseño de producto (modelo de datos + UX). NO es una fase del roadmap de "diseños
interactivos" (ese asume 1 plano/proyecto). Surge de una necesidad real del usuario (jun-2026).

## Problema (verificado en el código)

Hoy el modelo es **1 imagen efímera + 1 plano + entregables por proyecto**:
- La imagen subida en la ingesta **NO se persiste** (se manda a la IA y se descarta). El `Project`
  no tiene campo de imagen de origen.
- `CanvasState` es **1:1 con `Project`** (`projectId @unique`) → un solo plano por proyecto.
- No hay relación "esta imagen → produjo este diseño": el `Deliverable` no guarda su origen.
- El flujo de chat es lineal (ingesta de 1 foto → cualificación → entrega); en el paso 3 no se
  pueden añadir más imágenes.

El usuario necesita: un **inmueble (proyecto)** con **varias tomas/zonas** (aérea, entrada,
interior, trasera) + **varios planos**, un **diseño por cada una**, y poder **comparar** lo que
subió con lo que la IA generó, con **historial**.

## Lo que ya existe y se reaprovecha

- Infra de **MediaAsset + storage** (`admin.prisma`, `server/storage`) → persistir imágenes.
- Render desde plano (CRL-4), detección desde foto (F5), escala (F0), luces (F-LUZ), catálogo (F-CAT).
- El editor de plano y los entregables ya funcionan; el cambio es de ESTRUCTURA, no de capacidades.

## Decisiones a tomar en el brainstorm (antes de diseñar el esquema)

1. **Jerarquía:** ¿`Project` → muchas `Zona` (cada una con su imagen(es), su plano, sus diseños)?
   ¿O `Project` → muchos `Plano` + galería de imágenes a nivel proyecto? Definir el grano.
2. **Imagen de origen:** ¿una imagen por zona, o varias por zona (toma + detalles)? ¿Cuál es la
   "imagen de referencia" que alimenta el diseño?
3. **Migración:** proyectos v1 (1 plano, sin imágenes guardadas) deben seguir funcionando. ¿La zona
   por defecto envuelve el `CanvasState` actual?
4. **UX:** ¿navegación por zonas dentro del proyecto? ¿galería de "subí esto → generé esto"?
   ¿Dónde encaja el chat (hoy por proyecto) en un proyecto multi-zona?
5. **Privacidad/RGPD:** las imágenes persistidas son dato personal del usuario → retención,
   borrado (ya hay `deletion-service`/`retention-job`), anonimización (pii-scrub). Incluirlas.
6. **Coste/storage:** guardar imágenes y múltiples diseños multiplica storage → política de límites.

## Fases candidatas (a confirmar tras el brainstorm)

- **P1 · Persistir imagen de origen + comparativa** (lo más barato y de valor): guardar la imagen
  subida (MediaAsset, ligada al proyecto y al entregable que originó) y mostrar "origen ↔ diseño".
  No requiere multi-zona; da trazabilidad ya.
- **P2 · Galería de entradas/salidas por proyecto:** vista del historial (imágenes subidas +
  diseños generados, qué produjo qué).
- **P3 · Multi-zona (rediseño del esquema):** `CanvasState` deja de ser 1:1; introducir el concepto
  de zona/plano múltiple. Migración v1→v2. Es el cambio grande.

## Riesgos

- **Alto:** P3 toca el esquema central (`CanvasState` 1:1) y la UX del editor/chat. Migración de
  proyectos existentes. Requiere `/ck:predict` (migración + UX) antes de implementar.
- RGPD: persistir imágenes de usuario añade superficie de datos personales → diseñar retención/borrado.

## Cómo se ejecuta

1. **Brainstorm** de las 6 decisiones de arriba (jerarquía, migración, UX) → cerrar el modelo.
2. **/ck:plan** con las fases P1–P3 detalladas + migración.
3. **/ck:predict** sobre P3 (cambio de esquema + UX) antes de implementar.
4. Implementar por fases (P1 primero, da valor sin romper el modelo actual).

## Estado

📋 PLANIFICADO (brainstorm pendiente). No se ha tocado código. Documentado a raíz de la pregunta
del usuario; se diseña en condiciones antes de implementar.
