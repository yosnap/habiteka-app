# Estándares de Código — Habiteka

## Convenciones de nomenclatura

- **Archivos TS/JS:** kebab-case (ej. `user-service.ts`, `canvas-renderer.tsx`).
- **Tamaño máximo de archivos:** 200 líneas — fragmenta en módulos más pequeños manteniendo cohesión.
- **Componentes React:** `PascalCase` en el nombre del archivo y del componente.
- **Módulos/servicios:** `camelCase` en exports; `snake_case` en rutas de API.

## TypeScript

- **Strict mode obligatorio:** `"strict": true` en `tsconfig.json`.
- **Cero `any` en interfaces/contratos:** todos los tipos públicos (args, retorno) deben estar completamente tipados.
- **Discriminated unions** para state machines y eventos (`AgentStreamEvent`, `DebitHoldStatus`).

## Estructura de carpetas

```
src/
├── lib/
│   ├── contracts/          # 11 contratos congelados (F0) — lectura únicamente
│   ├── addons/
│   │   └── registry/       # Registry de módulos extensibles
│   └── licensing/          # Control legal + operativo (F13)
├── server/
│   ├── db/                 # Modelos Prisma, migraciones
│   ├── auth/               # Better Auth, scoping, guards
│   ├── actions/            # Server Actions autenticadas
│   ├── ai/                 # Adaptadores ChatVisionAdapter, ImageAdapter
│   ├── agent/              # Máquina de estados 5 fases + feedback (F5, F7)
│   ├── billing/            # DebitService, CreditLedger (F8)
│   ├── admin/              # Back-office BE (F15-F18)
│   ├── storage/            # StorageAdapter + MinIO (F17)
│   ├── privacy/            # RGPD, retención, supresión (F14)
│   └── legal/              # ToS, EULA, DPIA, banner cookies (F19)
├── app/
│   ├── (app)/              # App de usuario (rutas, layouts)
│   ├── (admin)/            # Back-office FE (layout admin)
│   └── api/                # Route handlers (auth, webhooks, health)
├── components/
│   ├── ui/                 # shadcn/ui primitivos
│   ├── canvas/             # Canvas Konva + controles (F4, F6, F7)
│   ├── agent-chat/         # Chat con agente
│   ├── deliverables/       # Panel entregables
│   ├── admin/              # Shell + módulos admin (F15-F18)
│   ├── addons/             # Votación, marketplace UI (F9, F10)
│   └── legal/              # Banner cookies, disclaimers (F19)
├── canvas/                 # Lógica pura Konva (sin React)
├── styles/                 # Tailwind v4 + tokens CSS
└── env.ts                  # Validación de variables de entorno (server-only)

prisma/
├── schema.prisma
└── migrations/             # Serial por naturaleza
```

## Reglas React

**NO usar `useEffect` directo.** Alternativas:
- **State derivado:** derivar desde props/state directo, sin efecto.
- **useMemo:** cálculos costosos que dependen de deps.
- **Event handlers:** responder a usuario, no a cambios de props.
- **useSyncExternalStore:** suscripción a estado externo (Konva, storage).
- **React Query / SWR:** data fetching + caching automático.

Si necesitas un efecto (ej. sync localStorage), **documenta el porqué** (invariante, race condition, trade-off).

## Server-only

- **Secrets jamás al cliente:** `OPENROUTER_API_KEY`, `IMAGE_PROVIDER_KEY`, `POLAR_*`, `DATABASE_URL`, `BETTER_AUTH_SECRET` solo en `src/server/`.
- Usa `'use server'` en Server Actions; valida roles/scoping en servidor.
- Presigned URLs al cliente para assets (expiración corta).

## Comentarios

Explica el **PORQUÉ**, no el QUÉ:

```typescript
// ✅ BIEN
// Usamos structured outputs de OpenRouter para garantizar schema válido
// sin parsear JSON manualmente (reduce latencia de reintento).
const response = await chatAdapter.call({ response_format: json_schema });

// ❌ MAL
// Llamar al adaptador con response_format.
// En comentarios NO referenciar: F5, fase 5, spike, plan section 9.1
```

**Ningún comentario debe referenciar números de fase del plan (F0-F19), hito (M1-M4), o sección del plan.** El contexto está en la arquitectura y los contratos.

## Conventional Commits

- `feat:` nueva funcionalidad.
- `fix:` bug fix.
- `refactor:` reorganización sin cambio de comportamiento.
- `test:` tests (nuevos o fixes).
- `docs:` documentación.
- `chore:` setup, deps, tooling.

Formato: `<type>: <scope> - <description>`. Sin referencias a IA ni planes en el mensaje.

Ejemplo: `feat: agent - add feedback loop with inpainting support`

## Testing — TDD (Test-First)

- **Pruebas ANTES del código:** escribir test rojo, luego código verde.
- **Pirámide:** unit (base) → integration → e2e (pico).
- **Mocks únicamente para servicios externos:** OpenRouter, proveedor imagen, Polar, bases de datos externas.
  - **Cero mocks de lógica propia:** state machine, ledger, guards, sanitizer.
- **Postgres efímera en CI:** container de test, fixtures deterministas.
- **Cero llamadas reales a IA/pagos en CI:** fixtures congeladas.
- **Cobertura:** mínima 80% en M1 (contratos+datos), 85% en M2 (flujo core), 90% en M4 (release).

Ejemplo:

```typescript
// test/server/agent.state-machine.test.ts
describe('AgentStateMachine', () => {
  it('transitions from ingestion to qualification on image input', () => {
    const sm = new StateMachine();
    sm.ingest(mockImage);
    expect(sm.state).toBe('qualification');
  });
});
```

## File Ownership por Rol (Globs)

| Rol | Owner de |
|---|---|
| **ARQ** | `package.json`, `tsconfig.json`, `src/lib/contracts/**`, `src/lib/addons/registry/**`, `src/lib/licensing/**`, `docs/legal/**`, `src/server/privacy/**`, `src/server/legal/**`, `tests/integration/e2e-flow/**` |
| **BE** | `prisma/**`, `src/server/{db,auth,actions,billing,admin,storage}/**`, `src/app/api/` |
| **FE** | `src/app/(app)/**`, `src/app/(admin)/**`, `src/components/**`, `src/canvas/**`, `src/styles/**` |
| **IA** | `src/server/ai/**`, `src/server/agent/**`, `docs/spikes/**`, `tests/spikes/**` |
| **UX** | `docs/ux/**`, design tokens, guías de componentes |
| **QA** | `tests/**`, `playwright/**`, `*.test.ts` |
| **OPS** | `.github/**`, `Dockerfile`, `infra/**`, `.env.example` |

Globs **disjuntos:** NO hay overlaps. Cambios en otra zona = PR con revisión de ARQ.

## Compilación y Linting

> **Runtime:** Bun es el package manager y ejecutor de scripts/tests (`bun install`, `bun run`, `bun test`); Node sirve la app en prod/Docker. Dev local arranca en el puerto **3040** (`bun run dev`).

- **Build:** `bun run build` → sin errores TypeScript.
- **Linting:** `bun run lint` → obligatorio antes de commit (pre-commit hook).
- **Format:** Prettier vía pre-commit.

## Resumen

La meta es **modularidad clara, tipado estricto, tests antes del código, y trazabilidad jurídica** (comentarios explican el porqué técnico/legal, no referencias de plan). Cada rol respeta sus globs; contratos congelados evitan cascadas de cambios.
