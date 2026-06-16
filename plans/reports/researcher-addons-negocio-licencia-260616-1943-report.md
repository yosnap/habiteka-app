# Investigación: Arquitectura de Add-ons, Modelo de Negocio y Licencia | Habiteka

**Fecha:** 2026-06-16 | **Investigador:** Researcher | **Estado:** FINAL

---

## 1. ARQUITECTURA DE ADD-ONS / PLUGINS EXTENSIBLE

**Recomendación:** Monolito modular inicialmente (YAGNI), no micro-frontends.

| Aspecto | Recomendación | Justificación |
|--------|---------------|---------------|
| **MVP Arquitectura** | Monolito modular con exportación de interfaces TypeScript | Equipos <8 personas, Build 10.7s vs 113.8s en micro-frontends; 1.85 MiB vs 50.75 MiB JS. |
| **Sistema de Plugins** | Registry dinámico + hooks (ex: `canvas:elementAdded`, `agent:responseReady`) | Patrón probado (VS Code, Webpack). Define contrato en interfaces TypeScript; plugins implementan. |
| **SDK Core** | `@habiteka/sdk`: types + hooks + service locator + validation | Plugin loader valida versionado (semver); rechaza incompatibles. No romper main si plugin falla. |
| **Punto de Extensión** | Canvas (drop zone para widgets), Agente (handlers de diálogo), Exportación | Suficiente para votación y marketplace sin complejidad distribuida. |
| **Aislamiento** | Plugins en carpeta `/addons/{nombre}/` con `addon-manifest.json` + entrypoint estándar | Fácil agregar/remover sin refactor central. Validar tipos en CI. |
| **Versionado SDK** | Semver strict. SDK v2 incompatible → rechaza plugins v1 en runtime. | Previene crash silent. Público sabe límites. |
| **Ruta a Futura Escalabilidad** | Si crece: Module Federation + dynamic imports (federated modules por addon). | Permite deploy independiente después sin refactor SDK. Hoy: overkill. |

Fuente: [Building Plugin Architecture in Node.js](https://oneuptime.com/blog/post/2026-01-26-nodejs-plugin-architecture/view), [Monolith vs Modular Frontend Architecture](https://altersquare.medium.com/monolith-vs-modular-frontend-architecture-when-each-breaks-464ae461f5db).

---

## 2. ADD-ON VOTACIÓN COMUNITARIA — ALCANCE MVP

**Recomendación:** Polling (no WebSocket) en MVP. Datos simples. Sin anon.

| Feature | MVP | Post-MVP |
|---------|-----|----------|
| **Salas Compartidas** | Room ID único + link copiable (`/vote/ABC123`) | Salas persistentes, control de acceso |
| **Votación Real-time** | Polling 2s (suficiente para 10-50 usuarios) | WebSocket si >100 usuarios/room |
| **Modelo Datos** | Room (id, creador, elementos[], estado), Vote (usuarioId, elementoId, voto) | Redis cache, historial completo |
| **Anonimato** | NO en MVP. Require login (email/SSO). Rastrear por user ID. | Opción anon con fingerprinting después |
| **Moderación** | Creador puede borrar votos/comentarios; flag manual. | AI moderación, auto-delete spam |
| **Límites MVP** | Max 5 elementos/room, 50 votos simultáneos, 24h expiry | Escalable después con Redis/queue |

Lógica polling: cada 2s client hace GET `/api/room/{id}/votes` → DB query simple. Base de datos: tabla `rooms`, `votes`, `comments`. Sin WebSocket = menos infraestructura, funciona offline-first con reconciliación.

Fuente: [Best Stack for Real-Time SaaS in 2026](https://www.buildmvpfast.com/best/realtime-saas), [Real-Time Voting App with WebSockets](https://dev.to/wasp/build-a-real-time-voting-app-with-websockets-react-typescript-1bm9).

---

## 3. ADD-ON MARKETPLACE / FABRICANTES — ALCANCE MVP

**Recomendación:** Catálogo curado mock (NO integración Ikea/Amazon real aún).

| Aspecto | MVP | Por qué no integraciones reales en MVP |
|--------|-----|-------|
| **Data Catálogo** | ~500 productos curados (JSON/DB local): muebles, puertas, azulejos, colores Ikea/Leroy Merlin | APIs Ikea/Amazon sin documentación oficial pública. PA-API de Amazon **sunset 2026-04-30** → migration a Creators API aún inestable. ROI bajo para MVP. |
| **Modelo Producto** | `id, nombre, imagen, precio, dimensiones, categoría, tienda_origen, enlace_afiliado` | Suficiente para drag-drop y estimación de presupuesto. |
| **Afiliación** | Link de afiliado hardcoded por tienda (Ikea, Amazon Associates). User hace click → affiliate tracking. | Convertir a API query después (si Amazon Creators API estabiliza). |
| **Canvas Integration** | Arrastrar producto → agrega SVG/imagen + metadata al canvas. Muestra precio estimado total. | Simple. No requiere sync real-time con catálogo externo. |
| **Post-MVP** | Integración oficial Ikea/Amazon cuando APIs maduran. Sync catálogo diario. | Elasticidad precio, stock, recomendaciones. |

**Gestión de Comisiones MVP:** Google Sheet manual o Stripe Payouts setup. Rastrear clicks → conversiones en plataforma de afiliados oficial (Amazon Associates, Ikea Bussiness Partner). Liquidar mensual. Escalar a tracking automático después.

Fuentes: [Amazon PA-API Sunset April 30, 2026](https://muntaseerrahman.com/blog/amazon-pa-api-sunset-creators-api-migration/), [Amazon Product Advertising API](https://webservices.amazon.com/paapi5/documentation/), [IKEA Product Details API](https://zylalabs.com/api-marketplace/commerce+&+ecommerce/ikea+product+details+api/2226).

---

## 4. LICENCIA RECOMENDADA: SUSTAINABLE USE LICENSE (n8n style)

**Recomendación:** Sustainable Use License (fair-code) dual con opción AGPLv3 académica.

| Licencia | Fits Habiteka? | Notas |
|---------|----------------|-------|
| **Sustainable Use License** | ✅ **SÍ (PRIMARY)** | n8n precedent. Fuente abierta, extensible, pero comercial (SaaS/resales) prohibido sin permiso. Self-host gratis internamente. |
| **Business Source License (BSL)** | ⚠️ Alternativa | Más estricto (change date fijo). HashiCorp model. Overkill si no necesitas date-based conversion. |
| **Elastic License 2.0** | ✗ No (demasiado restrictivo) | Prohibe managed service. Habiteka necesita ecosistema de servidores. |
| **SSPL** | ✗ No | Requiere publicar herramientas de operación. Demasiado burden para MVP. |
| **AGPLv3 (academic)** | ✅ Dual option | Proyectos educativos/no-comerciales pueden usar AGPLv3 gratis. Investigadores, startups estudiantes. |

**Por qué Sustainable Use License:**
- n8n (workflow automation) comparte exact modelo: self-host free, SaaS hosting oficial required para comercial.
- Fair-code = "open source + commercial safeguard."
- Habiteka requisito similar: arquitectos/diseñadores pueden forkear y aprender (source open), pero no pueden reseller sin permiso (protege margen de hosting oficial).
- Pone carga en Habiteka Inc para mantener serverless/cloud atractivo (ej: precios competitivos, integración AI sin fricciones).

Fuente: [Sustainable Use License | n8n Docs](https://docs.n8n.io/sustainable-use-license/), [Announcing the new Sustainable Use License – n8n Blog](https://blog.n8n.io/announcing-new-sustainable-use-license/).

---

## 5. CUMPLIMIENTO / MECANISMO DE CONTROL DE LICENCIA

**Recomendación:** OpenRouter como cuello de botella único + API key de servidor.

| Mecanismo | Detalles | Cumple Requisito Spec |
|-----------|----------|----------------------|
| **Control Primario** | OpenRouter API key hardcoded en backend (servidor oficial). Usuarios NO pueden acceder directamente. | ✅ Imposible saltarse sin acceso a OpenRouter key. |
| **Validación de Licencia** | Server central emite JWT con claims: `licenseType`, `expiryDate`, `tier` (free/pro/enterprise). Client manda JWT en cada invoke de agente. | ✅ Token expirado = agente rechaza. |
| **Phone-home Opcional** | Backend logs cada invocación (user ID, addon usado, timestamp) a DB central. Telemetría anónima de uso. | ⚠️ Útil para datos, no mandatory para MVP. |
| **Gating de Features** | SDK valida licenseType en runtime: free tier → max 3 designs/mes, no marketplace. Pro → unlimited. | ✅ Client-side hint (UX), server-side enforced (security). |
| **Despliegue Externo** | Tercero fork + self-host → agente local NO tiene OpenRouter key → invoke falla. Marketplace addons requieren API call a servidor central (falla si licencia inválida). | ✅ Spec requirement met. |
| **Migración a BSL** | Si future: cambiar a BSL + Keygen (license-gate like), pero innecesario hoy. OpenRouter es suficiente mecanismo de control. | Future-proof. |

**Implementación MVP (3-5 horas):**
1. Backend genera JWT al login con licenseType (hardcoded "free" para usuarios gratis).
2. Invoke agente requiere JWT válido en header.
3. OpenRouter call solo via servidor central (client nunca tiene key).
4. Simple, no requiere infraestructura license-gate separada.

Fuentes: [Keygen | Software Licensing API](https://keygen.sh/), [License Gate GitHub](https://github.com/DevLeoko/license-gate).

---

## RESUMEN EJECUCIÓN (6-8 líneas)

**Arquitectura:** Monolito modular TypeScript con registry dinámico de plugins (no micro-frontends). Hooks en canvas + agente. SDK versionado semver. ✓ Escalable después sin refactor.

**Votación MVP:** Polling 2s, salas ephemeral (24h), login required (no anon), DB simple (rooms/votes). Sufiicente para 50 usuarios/room. WebSocket post-MVP.

**Marketplace MVP:** Catálogo curado mock ~500 productos (JSON). Drag-drop canvas. Links de afiliación reales (Ikea, Amazon). NO integración API (Amazon PA-API sunset 2026-04, APIs Ikea unstable). Tracking manual. Escalar después.

**Licencia:** **Sustainable Use License (n8n style).** Fuente abierta, self-host gratis internamente, comercial/resales prohibido sin permiso. Dual AGPLv3 para académicos. ✓ Fair-code justificable.

**Control Licencia:** OpenRouter como cuello de botella único. JWT server-signed con licenseType. Client invoice agente + JWT → server valida y llama OpenRouter. Self-host fork → falla (no key). Implementación trivial MVP (3-5 horas).

---

## PREGUNTAS SIN RESOLVER

1. **Pricing concreto B2C:** ¿$9.99/mes basic + $1 por crédito extra? ¿Qué crédito = qué operación? → Requiere cálculo de costs OpenRouter + margen deseado.
2. **Onboarding de partners agremiados (Ikea, Amazon):** ¿Quién inicia contacto? ¿Req legal dedicado?
3. **Fair-code enforcement legal:** ¿Contratar layer legal para casos de BSL/Sustainable disputes?
4. **Roadmap de SSO/enterprise:** OAuth + SAML para B2B (arquitectos, empresas reformas) → MVP sin SSO, essential post-MVP.

---

**Status:** DONE

**Reporte:** `/Volumes/EVO990/Proyectos/CodeIA Academy Projects/habiteka/habiteka-app/plans/reports/researcher-addons-negocio-licencia-260616-1943-report.md`
