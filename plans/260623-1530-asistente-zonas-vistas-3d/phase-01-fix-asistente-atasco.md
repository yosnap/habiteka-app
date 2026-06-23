# Fase 1 — Fix: el asistente no se atasca si la generación falla

## Problema (bug confirmado)
Si la generación de entregables falla, `orchestrator.ts` (~línea 75, bloque catch de
`handleDeliver`) captura el error pero NO revierte ni avanza la fase. El usuario queda en el
paso 2/3 y al recargar "vuelve a salir" el mismo paso, sin saber por qué.

## Contexto
- `src/server/agent/orchestrator.ts`: `handleDeliver` genera entregables y, en éxito, persiste
  fase `feedback`. En error, no toca la fase.
- `src/components/chat/qualification-chat.tsx`: muestra el paso según `phase`; no hay estado
  de "error de generación".

## Requisitos
- Ante un fallo de generación: mantener una fase coherente (NO avanzar a feedback), exponer un
  ERROR claro al cliente y permitir REINTENTAR la generación sin recargar.
- Al recargar, no quedar atrapado: si no hay entregables, el paso debe invitar a reintentar.

## Enfoque
- En `handleDeliver` (orchestrator): en catch, devolver un resultado de error explícito
  (no silencioso) sin corromper la fase; loguear. No persistir `feedback` si no hubo éxito.
- En el chat: estado `generationError`; si la acción de generar devuelve error, mostrar aviso
  + botón "Reintentar" (re-llamar a `onDeliver`). El paso 2 sigue accesible.

## Tests / validación
- Test del orchestrator: si la generación lanza, la fase NO pasa a `feedback` y el resultado
  indica error. Verificación en navegador: forzar fallo → ver aviso + reintentar.
- tsc+eslint limpios; suite verde.
