# F9 — Add-on Votación Comunitaria (Frontend + Backend)

**Context Links:** [plan.md](plan.md) · [system-architecture.md](../../docs/system-architecture.md) (§7 add-ons, votación) · registry/contratos: [phase-00](phase-00-arq-setup-contratos.md) · modelos: [phase-02](phase-02-be-datos-auth.md) (`VotingRoom/Vote/Comment` en `prisma/schema/addons.prisma`) · canvas: [phase-04](phase-04-fe-canvas-konva.md) · panel entregables: [phase-06](phase-06-fe-chat-entregables.md)

## Overview
- **Rol primario:** FE + BE
- **Prioridad:** P2 (add-on de negocio, no bloquea flujo core)
- **Estado:** Completado (PR #20)
- **Depende de:** F4 (canvas: elementos seleccionables), F6 (panel de entregables: punto de entrada al add-on). Usa modelos de F2 y registry/slots de F0.
- **Paralela con:** F10 (marketplace) — globs disjuntos.
- **Descripción:** Add-on de **votación comunitaria** registrado contra la interfaz del registry de add-ons (F0). Salas compartidas con login, **polling ~2s** (WebSocket = post-MVP), enlaces compartibles, votos y comentarios sobre **elementos del diseño** (puertas, azulejos, colores, ascensor). Se enchufa en el slot `agent.postEntrega` (Fase 5 del agente) y opcionalmente `canvas.layers`.

## Key Insights
- **Implementado como add-on, no como feature suelta:** registra un `AddonDefinition` (`id:"voting"`, `slots:['agent.postEntrega','canvas.layers']`) vía `createAddonRegistry()` de F0. Mismas interfaces que usaría un tercero (las del registry quedan listas, sin plugin loader real — YAGNI).
- **Polling, no WebSocket (MVP):** intervalo ~2s suficiente para <50 usuarios/sala (arquitectura §7). Endpoint de lectura ligero (deltas desde `since` timestamp) para no recargar toda la sala. WebSocket = decisión post-MVP, no construir abstracción de transporte ahora.
- **Elementos votables = referencias, no copias:** un `Vote`/`Comment` apunta a un `targetRef` (id de elemento del diseño extraído en Fase 5: puerta, azulejo, color, ascensor). El add-on **no** reimplementa el escaneo de elementos; consume la lista que el agente (F5/F7) ya extrajo del entregable.
- **Salas con login (no anónimas):** votar/comentar requiere sesión (Better Auth de F2). El **enlace compartible** abre la sala; usuario sin sesión → flujo de login y vuelta a la sala (no se pierde el contexto).
- **Un voto por usuario por elemento:** unique `(votingRoomId, userId, targetRef)` → cambiar voto actualiza, no duplica.
- **Sin claves IA ni billing aquí:** el add-on no consume el agente directamente; si en el futuro re-escanea elementos eso pasa por F5 (que ya factura vía F8). MVP: solo lee elementos ya extraídos.

## Requirements
**Funcionales**
- Crear sala de votación desde un `Deliverable` aprobado (entrada en panel de entregables de F6 / slot postEntrega).
- Enlace compartible por sala (`/voting/[roomId]`); abrir requiere login para interactuar.
- Listar elementos votables de la sala (`targetRef` + etiqueta legible: puerta/azulejo/color/ascensor).
- Emitir/cambiar voto sobre un elemento; ver recuento agregado en vivo (polling ~2s).
- Comentar sobre un elemento; ver hilo de comentarios actualizado por polling.
- Endpoint de deltas (`GET ?since=`) para refrescar votos/comentarios sin recarga completa.

**No funcionales**
- Polling con backoff/visibilidad (pausar si pestaña oculta); ≤2s activo.
- Un voto por usuario/elemento (unique constraint). Mutaciones idempotentes.
- Componentes y handlers ≤200 líneas. Tipos desde `@/lib/contracts` y Prisma (no redefinir).
- Server actions/route handlers validan sesión y pertenencia a la sala (scoping).

## Architecture
```
src/addons/voting/
  voting-addon.ts          # AddonDefinition + registro en el registry (F0)
  server/
    room-repo.ts           # CRUD VotingRoom (crea desde Deliverable)
    vote-service.ts        # upsert voto (unique userId+targetRef), recuento agregado
    comment-service.ts     # crear/listar comentarios por targetRef
    deltas.ts              # lectura incremental (votos+comentarios desde `since`)
  ui/
    voting-room.tsx        # contenedor de sala (Client Component, polling)
    use-room-poll.ts       # hook polling ~2s con pausa por visibilidad
    element-vote-list.tsx  # elementos votables + recuento + botón votar
    comment-thread.tsx     # hilo de comentarios por elemento
    share-link.tsx         # copia el enlace compartible de la sala
src/app/api/voting/
  rooms/route.ts           # POST crear sala (auth, desde deliverableId)
  rooms/[roomId]/route.ts  # GET sala + deltas (?since=); auth para mutar
  votes/route.ts           # POST upsert voto (auth)
  comments/route.ts        # POST comentario (auth)
src/app/(app)/voting/[roomId]/
  page.tsx                 # vista de sala (monta voting-room.tsx)
```
**Data flow (crear sala):** F6 panel entregables → `POST /api/voting/rooms {deliverableId}` → `room-repo` crea `VotingRoom` + materializa elementos votables (`targetRef`) desde el `Deliverable` → devuelve `roomId` + enlace. **Data flow (votar):** UI → `POST /api/voting/votes {roomId,targetRef,value}` (auth) → `vote-service` upsert (unique) → recuento. **Data flow (live):** `use-room-poll` cada ~2s → `GET /api/voting/rooms/[roomId]?since=ts` → `deltas` → UI actualiza recuentos/comentarios.

## Related Code Files
**A crear (owner F9):** todos los ficheros del árbol anterior.
**Owner globs:** `src/addons/voting/**`, `src/app/api/voting/**`, `src/app/(app)/voting/**`.
**Lee/usa (no edita):** `src/lib/contracts/**` y `src/lib/addons/registry/**` (F0: `AddonDefinition`, `createAddonRegistry`); modelos Prisma `VotingRoom/Vote/Comment` (F2, declarados en `prisma/schema/addons.prisma`); `src/server/auth/**` (F2: sesión); lista de elementos extraídos por F5/F7 (vía `Deliverable.payload`); utilidades read-only de `src/canvas/**` (F4) si pinta marcadores.
**NO tocar:** `prisma/schema/**` (owner F2 — campos de `VotingRoom/Vote/Comment` se acuerdan con F2, no se editan aquí); `src/server/agent/**`, `src/server/ai/**` (F5/F3); `src/components/**` y `src/app/(app)/projects/**` (F4/F6); `src/addons/marketplace/**` (F10).

## Implementation Steps
1. `voting-addon.ts`: declarar `AddonDefinition` y registrarlo en el registry de F0 (slots `agent.postEntrega`, `canvas.layers`).
2. `server/room-repo.ts`: crear `VotingRoom` desde `deliverableId`; materializar `targetRef`+etiqueta de los elementos del entregable.
3. `server/vote-service.ts`: upsert voto con unique `(votingRoomId,userId,targetRef)`; recuento agregado por elemento.
4. `server/comment-service.ts`: crear/listar comentarios por `targetRef`.
5. `server/deltas.ts`: lectura incremental por `since` (votos+comentarios nuevos/cambiados).
6. Route handlers `api/voting/**`: validar sesión (F2) y pertenencia a sala; POST sala/voto/comentario; GET sala+deltas.
7. `ui/use-room-poll.ts`: polling ~2s con pausa por `document.hidden`; backoff ante error.
8. `ui/voting-room.tsx` + `element-vote-list.tsx` + `comment-thread.tsx` + `share-link.tsx`: sala, lista votable, hilos, copia de enlace.
9. `app/(app)/voting/[roomId]/page.tsx`: vista que monta la sala; sin sesión → CTA login y retorno.
10. Tests (delegados a F12): upsert no duplica voto; deltas devuelven solo lo nuevo; sala requiere auth para mutar. `bun run typecheck`/`bun run build` verdes.

## Todo List
- [x] `AddonDefinition` de votación registrado en el registry (slots agent.postEntrega/canvas.layers)
- [x] `room-repo`: crear sala desde deliverable + materializar elementos votables (del payload)
- [x] `vote-service` con unique voto/usuario/elemento (upsert) + recuento agregado
- [x] `comment-service` por elemento (texto plano, anti-XSS)
- [x] Endpoint de deltas (`?since=`) — votos agregados + comentarios nuevos
- [x] Route handlers `api/voting/**` con auth (votar requiere sesión)
- [x] Hook polling ~2s (pausa por `document.hidden`, vía `useMountEffect`)
- [x] UI: sala, lista votable con recuento en vivo, comentarios
- [x] Vista `(app)/voting/[roomId]`
- [x] Tests verdes (upsert no duplica, agregación, deltas por since, registro add-on)

## Success Criteria
- Desde un entregable aprobado se crea una sala con enlace compartible.
- Un usuario con sesión vota/cambia voto sobre un elemento; el recuento se refleja en ≤~2s vía polling.
- Comentarios por elemento aparecen en el hilo sin recarga completa.
- Un mismo usuario no duplica voto sobre el mismo elemento (unique).
- Add-on registrado vía la interfaz del registry de F0 (no acoplado fuera de los slots).

## Risk Assessment
| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Polling ~2s satura DB con muchas salas | Media | Medio | Lectura por deltas (`since`); pausa por pestaña oculta; índices por `roomId`/`createdAt`; WebSocket queda post-MVP |
| Voto duplicado / race al cambiar voto | Media | Medio | Unique `(roomId,userId,targetRef)` + upsert transaccional |
| Enlace compartible expone sala a no autorizados | Media | Alto | Ver requiere sala existente; mutar requiere sesión + pertenencia; sin datos sensibles del proyecto en la sala |
| `targetRef` desincronizado si el diseño cambia | Media | Medio | Sala se ancla a una versión de `Deliverable`; cambios mayores → nueva sala |
| Solape de modelos con F2 | Baja | Alto | F2 posee `prisma/**`; F9 solo consume; campos acordados en F0/F2 |

## Security Considerations
- Mutaciones (voto/comentario) exigen sesión Better Auth (F2) y pertenencia a la sala; lectura de sala controlada por existencia del enlace (sin exponer datos de proyecto fuera de los elementos votables).
- Sanitizar/escapar texto de comentarios (evitar XSS); no renderizar HTML crudo.
- Rate-limit básico en POST de votos/comentarios para evitar spam vía enlace público.
- Sin claves IA/billing en este add-on; no invoca al agente directamente en MVP.

## TDD / Pruebas primero
Escribir ANTES del código (rojo→verde→refactor), integration/Vitest contra DB de test:
- **No doble-voto**: upsert con unique `(roomId,userId,targetRef)` → cambiar voto actualiza, no duplica; voto concurrente no rompe el recuento. Rojo sin unique+upsert.
- **Deltas por `since`**: `GET ?since=ts` devuelve solo votos/comentarios nuevos o cambiados, no la sala completa. Verde al implementar `deltas`.
- **Auth para mutar**: votar/comentar sin sesión → rechazo; abrir sala vía enlace no expone datos del proyecto fuera de los elementos votables.
- **Registro como add-on**: el `AddonDefinition` de votación se registra en los slots correctos vía el registry de F0.
- **Mock:** ninguna IA/pago (el add-on no los consume); se aísla el polling de UI con timers falsos en el component test. DB y servicios propios NO se mockean.

## Next Steps
Add-on autónomo: no desbloquea fases posteriores. Las interfaces del registry que ejercita validan que F10 (marketplace) y futuros add-ons de terceros encajen en los mismos slots. Migración a WebSocket (post-MVP) reemplazaría solo `use-room-poll`/`deltas` sin tocar el modelo.
