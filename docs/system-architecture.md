# Arquitectura del Sistema — Habiteka

> Plataforma de diseño, reformas e interiorismo inteligente. Canvas interactivo + agente IA intérprete que transforma bocetos/planos/fotos en documentación técnica profesional.
> **Estado:** Diseño conceptual (bootstrap). Stack cerrado, sin implementación todavía.

## 1. Visión técnica

Habiteka es un **monolito modular** Next.js full-stack. El núcleo es un canvas web donde el usuario aporta una imagen de origen; un agente IA orquestado en 5 fases (Ingesta → Cualificación → Entrega → Feedback → Add-ons) produce entregables profesionales (plano 2D acotado, render 3D, memoria de materiales). La extensibilidad (add-ons de votación y marketplace) se resuelve con un **registry de módulos** e interfaces de extensión claras, sin micro-frontends en el MVP (YAGNI).

## 2. Stack tecnológico (cerrado, jun 2026)

| Capa | Tecnología | Versión |
|---|---|---|
| Package manager / scripts / tests | Bun (`bun install`, `bun run`, `bun test`) | 1.x |
| Runtime servidor (prod/Docker) | Node.js (servidor de Next standalone) | 22 LTS |
| Framework | Next.js (App Router, RSC, Server Actions) | 16.2.x |
| UI runtime | React | 19.2.x |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS v4 + shadcn/ui | v4 |
| Canvas | Konva + react-konva | 10.3 |
| Base de datos | PostgreSQL (JSONB para estado de canvas) | 16+ |
| ORM | Prisma | 7.x |
| Auth | Better Auth (self-host) | 1.6 |
| IA chat/visión | OpenAI SDK → OpenRouter (baseURL) | — |
| Imagen/Render 3D | Proveedor de imagen (FLUX/Nano Banana/Imagen) vía adaptador | — |
| Pagos | Polar.sh (Merchant of Record) | — |
| Tiempo real (votación) | Polling MVP → WebSocket post-MVP | — |

> **Runtime — Bun como herramienta, Node como servidor:** Bun es el package manager y ejecutor de scripts/tests del repo (sustituye a npm/pnpm: `bun install`, `bun run dev`, `bun test`). El **servidor de Next en producción/Docker corre sobre Node.js** (servidor `standalone` oficial), porque servir Next sobre el runtime de Bun aún arrastra incompatibilidades con Next 16 standalone, Prisma y libs nativas. Decisión de menor riesgo: velocidad de Bun en dev/CI, estabilidad de Node en prod.
>
> **Puerto de desarrollo:** la app arranca por defecto en el **puerto 3040** (`bun run dev`, configurado vía script `-p 3040`). Es solo para dev local; producción/Docker usa su propia config de puerto (`PORT` por env, normalmente tras proxy).

## 3. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                        │
│  Next.js App Router · React 19 · shadcn/ui · Konva Canvas     │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Canvas UI  │  │ Chat Agente  │  │ Panel Entregables   │   │
│  │ (react-    │  │ (cualific.)  │  │ + Add-ons UI        │   │
│  │  konva)    │  └──────────────┘  └─────────────────────┘   │
│  └────────────┘                                              │
└───────────────┬─────────────────────────────────────────────┘
                │ Server Actions / Route Handlers (RSC)
┌───────────────▼─────────────────────────────────────────────┐
│                  SERVIDOR (Next.js, Node)                     │
│  ┌──────────────┐  ┌───────────────────────────────────┐     │
│  │ Auth         │  │ Orquestador del Agente (5 fases)   │     │
│  │ (Better Auth)│  │ State machine + tool-calling       │     │
│  └──────────────┘  └───────────┬───────────────────────┘     │
│  ┌──────────────┐              │                              │
│  │ Créditos /   │   ┌──────────▼──────────┐                   │
│  │ Suscripción  │   │ Adaptadores de IA   │                   │
│  │ (Polar)      │   │ - chat/visión (OR)  │                   │
│  └──────────────┘   │ - imagen/render     │                   │
│  ┌──────────────┐   └──────────┬──────────┘                   │
│  │ Registry de  │              │                              │
│  │ Add-ons      │   ┌──────────▼──────────┐                   │
│  └──────────────┘   │ Prisma 7 · Postgres │                   │
│                     └─────────────────────┘                   │
└───────────────┬─────────────────────────────────────────────┘
                │ (server-side only — API keys nunca al cliente)
       ┌────────▼────────┐   ┌──────────────────┐  ┌──────────┐
       │   OpenRouter    │   │ Proveedor Imagen │  │  Polar   │
       │ (chat + visión) │   │ (render/inpaint) │  │  (pagos) │
       └─────────────────┘   └──────────────────┘  └──────────┘
```

**Principio de control de licencia (legal + operativo):** todas las llamadas a IA pasan por el servidor oficial de Habiteka, que es quien posee la API key de OpenRouter (nunca expuesta al cliente). La barrera real es **operativa** —el servicio oficial con la key y la infraestructura— y **legal** —la Sustainable Use License—, no una imposibilidad técnica: un fork self-hosted que aporte su propia key puede ejecutar el agente, pero queda fuera de la licencia comercial. Cumple el requisito fair-code (sección 5 del PRD) por la vía legal/operativa, no por bloqueo técnico.

## 4. El Agente Intérprete (máquina de estados de 5 fases)

El agente es un **orquestador con state machine** persistida por proyecto. Cada fase tiene entrada, procesamiento y salida definidos.

| Fase | Entrada | Procesamiento IA | Salida | Modelo OpenRouter |
|---|---|---|---|---|
| **1. Ingesta** | Imagen/dibujo/plano | Visión: detectar muros, ventanas, puertas, pilares, límites | Elementos estructurales (JSON) + disclaimer legal | Modelo de visión (Claude/Gemini vía OR) |
| **2. Cualificación** | Respuestas del chat | Diálogo con tool-calling: objetivo, estilo, entregables | Requisitos consolidados (JSON) | Chat con tool-calling |
| **3. Entrega** | Requisitos + análisis visual | Generación: plano 2D (JSON estructurado), render 3D (proveedor imagen), memoria materiales | Entregable con sello legal indeleble | Chat (structured output) + proveedor imagen |
| **4. Feedback** | Selección de zona + instrucción | Modificación selectiva: inpainting (imagen) o regeneración parcial (JSON) | Entregable refinado, resto intacto | Inpainting + chat |
| **5. Add-ons** | Diseño aprobado | Escaneo de elementos → votación / marketplace | Sala de votación + lista de productos | Chat (extracción) |

**Persistencia del diálogo:** cada turno y el estado de fase se guardan en Postgres (tablas `conversations`, `messages`, `project_state`). El estado del canvas (objetos Konva) se serializa a JSONB.

**Restricciones legales (obligatorias):**
- Disclaimer en pantalla de carga (Fase 1): *"El asistente automatizado de Habiteka interpretará los trazos de forma conceptual. Toda propuesta espacial generada requerirá validación por un profesional técnico cualificado del sector."*
- Sello indeleble en cada entregable: *"[ Documento conceptual generado por Habiteka AI - Revisión técnica requerida ]"*

## 5. Modelo de datos (conceptual)

```
User ──< Project ──< Conversation ──< Message
              │            
              ├──< CanvasState (JSONB: objetos Konva)
              ├──< Deliverable (tipo: plano2d|render3d|memoria; sello legal; versión)
              └──< Iteration (feedback por zona)

User ──< Subscription (plan, estado) [Polar]
User ──< CreditLedger (saldo, transacciones; débito por entregable)

Project ──< VotingRoom ──< Vote / Comment   [add-on votación]
Deliverable ──< MarketplaceItem (producto, link afiliación)  [add-on marketplace]

Addon (registry: nombre, versión SDK, puntos de extensión habilitados)
```

Detalle de campos y migraciones → se define en la fase de planificación (`/plans`).

## 6. Capa de IA — adaptadores

Dos adaptadores con interfaz común para no acoplar la lógica del agente a un proveedor:

- **`ChatVisionAdapter`** → OpenAI SDK con `baseURL` de OpenRouter. Streaming, tool-calling, structured outputs (`response_format: json_schema`), routing/fallback de modelos.
- **`ImageAdapter`** → proveedor de imagen (FLUX vía fal.ai / Nano Banana / Imagen) para render 3D e inpainting (Fase 4). Pieza enchufable.

**Créditos:** cada operación de IA reporta coste → se traduce a débito en `CreditLedger`. El plan define la tarifa por tipo de entregable.

## 7. Arquitectura de Add-ons (extensible, MVP pragmático)

- **Registry central**: un módulo registra add-ons con metadatos (nombre, versión de SDK, puntos de extensión que usa).
- **Puntos de extensión (slots)**: en el canvas (toolbar, capas) y en el flujo del agente (post-entrega → Fase 5).
- **MVP**: dos add-ons de primera parte (votación, marketplace) implementados contra las mismas interfaces que usarían terceros. NO se construye un sistema de plugins de terceros completo en MVP (YAGNI), pero las interfaces quedan listas.

### Add-on Votación Comunitaria (MVP)
Salas con login, polling cada ~2s (suficiente <50 usuarios/sala), enlaces compartibles, votos/comentarios sobre elementos (puertas, azulejos, colores, ascensor). WebSocket = post-MVP.

### Add-on Marketplace (MVP)
Catálogo curado propio (~productos seed en DB), drag&drop al canvas, links de afiliación reales (Ikea/Amazon Associates). Sin integración de API real de catálogo en MVP (Amazon PA-API y feeds Ikea inestables). Sync automático = post-MVP.

## 8. Modelo de negocio y licencia

- **B2B**: fair-code; uso comercial obliga a hosting oficial. **B2C**: gratis limitado + suscripción/créditos (Polar).
- **Licencia**: Sustainable Use License (estilo n8n) — fuente abierta, self-host interno permitido, explotación comercial restringida.
- **Control (legal + operativo)**: la barrera efectiva es que el servicio oficial posee la key de OpenRouter y la infraestructura (control operativo), respaldada por la licencia (control legal). El JWT firmado por el servidor sirve para gating de features y trazabilidad de uso —no es una imposibilidad técnica anti-fork: un fork con su propia key puede ejecutar el agente, pero infringe la SUL. La key nunca se expone al cliente.

## 9. Decisiones abiertas (al plan)

1. Proveedor de imagen concreto para render 3D (FLUX vs Nano Banana vs Imagen) — comparar calidad/coste en fase de implementación.
2. Estrategia de versionado del SDK de add-ons (semver) — detallar al abrir extensibilidad a terceros (post-MVP).
3. Modelo exacto de tarifas de créditos por entregable — calibrar con costes reales medidos.
