# Fase 2 — Flujo zona→imagen: subir imagen a una zona, gestionar zonas

## Objetivo
Modelo "ZONA PRIMERO": el usuario crea/elige una zona y sube SU imagen a esa zona; los
diseños se generan y se muestran por zona. Una imagen principal por zona.

## Contexto (scout)
- Esquema YA listo: `ProjectZone`, `SourceImage{zoneId?}`, `Deliverable{zoneId?, sourceImageId?}`.
- `zone-actions.ts` (`createZone`) + ZoneSwitcher ("+ Zona") ya crean zonas a mano.
- Subida + detección: `qualification-chat.tsx` → `agent-actions.ts` (ingesta) → `runIngesta`.
  Hoy la imagen va al plano por defecto (zoneId null); no se asocia a la zona activa.
- Falta: que la ingesta/subida use la ZONA ACTIVA (zoneId) y que el chat opere por zona.

## Requisitos
- Subir una imagen la asocia a la ZONA activa (`SourceImage.zoneId = zonaActiva`), no al plano
  por defecto.
- El asistente trabaja por zona: cambiar de zona muestra su imagen/estado/diseños.
- Poder crear una zona nueva y subir su imagen (reusando "+ Zona" + el chat).
- Sin zona seleccionada, comportamiento actual (plano por defecto) como fallback.

## Enfoque
- Propagar `zoneId` (zona activa del ZoneSwitcher) por la cadena: chat → `advanceAgent`/ingesta
  → `persistIngestImages`/`SourceImage`. Las acciones del agente ya reciben projectId; añadir
  zoneId con validación de pertenencia (scope org, anti-IDOR).
- El estado del asistente (fase) pasa a ser por (proyecto, zona) si hoy es por proyecto:
  verificar en `chat/page.tsx`/persistencia de fase; ajustar si la fase es global.
- UI: dejar claro a qué zona se sube; al crear zona, ofrecer subir su imagen.

## Tests / validación
- Acciones: subir imagen con zoneId la persiste con esa zona; validación de pertenencia.
- Verificación en navegador: crear 2 zonas, subir imagen distinta a cada una, generar y ver
  diseños por zona sin mezclar.
- tsc+eslint limpios; suite verde.

## Notas
- Varias imágenes por zona / elegir imagen activa = FUTURO.
- Confirmar si la fase del asistente es global del proyecto (hoy) o debe ser por zona — decide
  el alcance real de esta fase (posible ajuste de persistencia de fase).
