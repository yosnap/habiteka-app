# Changelog — Habiteka

Cambios significativos, features e hitos se documentan aquí. Formato [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — 2026-09-22

- Enlace "Administración" en la cabecera cuando el usuario en sesión tiene rol admin.
- Icono para mostrar/ocultar la contraseña y etiquetas visibles en los formularios de registro y acceso.

### Changed — 2026-09-22

- Registro: sin `RESEND_API_KEY` configurada, el alta no exige verificar el correo (se abriría sesión sin poder enviar el email de verificación). Se activa sola en cuanto se configura la clave.

### Fixed — 2026-09-22

- Errores de negocio (Términos sin aceptar, consentimiento pendiente, proveedor de IA caído, saldo insuficiente, guardas del estudio y del agente) ya no llegan como un 500 sin explicación: las Server Actions expuestas al cliente los devuelven como dato y la pantalla muestra el mensaje real.

### Fixed — 2026-09-21

- Editor v2: la rasterización del documento declara el tamaño de salida en el SVG; los planos grandes superaban el límite de píxeles de sharp y la acción del proyecto devolvía 500.
- Estudio de plano: aviso y botón para aceptar los Términos de Servicio en la propia pantalla, con mensaje claro en lugar de un 500 cuando faltan (también al entrar en la importación CAD/PDF). Componente compartido con el chat. `docker-compose.yml` de desarrollo usa las imágenes de MinIO de quay.io.
- Imagen Docker: se incluye la librería nativa libvips de `sharp`; las páginas que rasterizan imágenes (chat de proyecto) devolvían 500 en producción. Test de rendimiento del canvas medido como p95 real con calentamiento para que no falle en CI.

### Changed — 2026-09-20

- Despliegue con Dokploy: la imagen Docker aplica las migraciones de Prisma al arrancar (`docker-entrypoint.sh`), el build funciona en clon limpio y omite el chequeo de tipos (CI sigue siendo la puerta). Retirado el workflow de Easypanel; documentación de `infra/` actualizada.

### Fixed — 2026-09-18

- Exterior/jardín clasificado en Construir por familias; pufs e iluminación permanecen en Amueblar.
- Nombres reales de catálogo en selector, propiedades y pintura, respetando nombres personalizados.
- Panel común de acabados cerca de la selección 2D/3D, ajustado al espacio de la ventana, también para suelos y techos/luces.


- Referencias magnéticas comunes de bordes, extremos y centros, con guías durante arrastre de objetos, superficies, aberturas y anotaciones. Contacto con cara física de pared prioritario.
- Flechas para todas las categorías seleccionables, deduplicando vértices y conservando anfitrión de aberturas y límites protegidos.
- Campos numéricos con botones al foco y flechas repetidas sin perder foco; coma decimal conservada.


- Miniaturas exteriores con geometría de cada objeto en lugar del icono genérico compartido.
- Menú de superficies y arrastre de patios dibujados, preservando vértices compartidos. Texturas accesibles desde el menú, sin panel automático superpuesto.
- Eliminada X central del menú radial; texto y medidas también muestran acción de eliminación.

### Added — 2026-09-18

- Patio/terraza como superficie abierta dibujable; ocho recubrimientos exteriores propios y 28 objetos paramétricos, incluidos barbacoa, vegetación, cerramientos, piscina elevada y tiras LED compartidas con interior.
- Norma general de dibujo: lápiz, arrastre y retorno automático a selección tras crear paredes, muretes, habitaciones, patios y medidas. Ayudas actualizadas.
- Colocación exterior prefiere patio; parking y drenajes bajos admiten objetos encima; navegación bajo pérgolas evita postes. Copiar escaleras de esquemas antiguos ya no añade un campo `columns` vacío incompatible.


- **Imágenes de las vistas del recorrido:** asociación persistida al generar desde un punto,
  miniatura y apertura del resultado, regeneración individual y sustitución desde la galería
  de encuadres compatibles. URLs renovadas y aviso si cambia la cámara de la vista.

- **Secuencia de vistas del recorrido:** tira horizontal para elegir y reordenar los puntos
  que se usarán para imágenes sin cambiar el trayecto de cámara. Selección guardada con el
  plano, compatible con deshacer/rehacer y plantas; acceso al diseño individual de cada vista.
- **Controles rápidos del editor espacial:** menú compacto centrado en la cabecera para
  mostrar u ocultar paredes, muebles y cotas (todas, solo exteriores u ocultas). Incluye
  activación de atajos y evita capturarlos mientras se escribe en un campo.
- **Atajos y catálogo:** S selecciona, B dibuja un muro, R crea una habitación, D/V/H
  insertan huecos, M mide y F abre el catálogo. El catálogo de muebles se muestra en el
  lateral izquierdo, junto a las herramientas de construcción.
- **Diseñar desde un punto del recorrido:** captura interior con la pose del punto y acceso
  al diálogo existente de estilos/render. La previsualización conserva cámara al cambiar luz.
- **Cámara en entregables:** imágenes generadas desde escena y PNG nativo guardan posición,
  foco, FOV y planta; compatibilidad con capturas anteriores sin esos campos.

### Fixed — 2026-09-17

- **Plantillas del asistente:** conversión al editor métrico con muros verticales
  correctos, ejes conectados y altura original. Metadatos desconocidos siguen
  bloqueando la activación; el snapshot original se conserva.
- Color de emisión de luminarias aplazado: [issue #42](https://github.com/yosnap/habiteka-app/issues/42).

### Added — 2026-09-17

- **Recorridos 3D nativos:** rutas automáticas por estancias y puertas, edición de puntos
  en 2D, reproducción y MP4 1080p30 guardado en Diseños/Historial sin consumo de IA.
  Schema 9 por planta; bloqueo de tramos con obstáculos; exportación de hasta 60 s.
  [Validación F2](../plans/reports/impl-260917-recorridos-f2.md).

- **Techo por estancia en editor v2:** techo plano o falso techo, descenso y color;
  visualización oculta, transparente o sólida independiente del acabado.
- **Luminarias persistidas:** colgantes, plafones y focos, con anclaje al techo,
  posición, caída, temperatura, flujo y encendido; edición en panel y símbolos 2D.
- **Propuesta de iluminación local:** estilos moderno y mediterráneo, revisión
  editable y aceptación atómica que conserva las luces anteriores. No utiliza un
  modelo IA remoto ni consume créditos.
- **Contrato de documento v8:** techos/luminarias explícitos, compatibilidad de
  documentos anteriores y conservación por planta. Conflictos de estancia o
  soporte generan avisos para revisión.
- **Contexto de diseño y render:** entidades aceptadas en prompts completos,
  compactos y alternativos; la transparencia de edición no se interpreta como
  cristal. Fidelidad visual del proveedor pendiente de validación externa.
- Uso y límites: [controles del editor espacial](ux/editor-spatial-controls.md).

### Added — 2026-06-23

- **El render del chat respeta la foto del espacio (img2img):** al generar desde el
  asistente, el render parte de la foto ACTIVA de la zona (no inventa otro inmueble).
  El servidor carga los bytes de la foto y los pasa como referencia; el flujo del
  lienzo (que ya pasaba referencia) y la idempotencia de cobro quedan intactos.
- **Panel de fotos por zona (reutilizable):** subir varias fotos a una zona, verlas en
  miniaturas y elegir la ACTIVA (la que usa el render). Disponible en el asistente y en
  el plano (toggle «Fotos del espacio»). Subida con consentimiento RGPD y scope de
  organización (anti-IDOR).
- **Tipo de zona (interior/exterior):** selector en el panel de fotos que adapta la
  descripción del render (un interior y una fachada/jardín se describen distinto).

### Added — 2026-06-16

- **Bootstrap del proyecto:** especificación técnica leída y validada.
  - Stack cerrado: Next.js 16.2, React 19.2, TypeScript 5, Tailwind v4, shadcn/ui, Konva 10.3.
  - Arquitectura aprobada: monolito modular, agente intérprete (5 fases), extensibilidad fair-code.
  - Plan por roles generado: F0-F19 con grafo de dependencias, hitos M0-M4 (incremental).
  - Validation pipeline: predict (6 roles), consistencia (11 contratos), TDD (test-first), red team (6 vectores).

- **Documentación base creada:**
  - `docs/system-architecture.md` — diseño conceptual, stack tecnológico, modelo de datos, agente 5 fases.
  - `docs/code-standards.md` — convenciones (kebab-case, archivos ≤200 líneas, TypeScript strict, TDD).
  - `docs/development-roadmap.md` — fases F0-F19, hitos M0-M4, decisiones clave documentadas, riesgos abiertos.
  - Plan detallado en `plans/260616-2004-habiteka-mvp-equipo/` con phase files.

- **Setup técnico completado:**
  - Repo público `yosnap/habiteka-app` creado en GitHub.
  - Branching avanzado instalado: rama por tarea `feat/<rol>/<task>` → `develop` (gate team lead) → `main` (bloqueada, semver).
  - CI/CD base preparado (F11 en roadmap).

- **Decisiones de negocio documentadas:**
  - MVP completo: 5 fases agente + render 3D + add-ons (votación, marketplace) + créditos + admin dashboard.
  - Fair-code license + control operativo (legal + infraestructura).
  - TDD obligatorio + mocks solo servicios externos (OpenRouter, Polar, imagen) — cero net en CI.
  - Contract freeze gate (F0 congelado antes M2); M0 quality gate (spike render 3D) — GO/NO-GO antes M2.

- **Riesgos abiertos identificados:**
  - Re-scope del MVP (inclusión votación/marketplace/render 3D) — producto decide.
  - Modelo de pricing (por intento vs por resultado) — afecta F8 logic y conversión.

### Pendientes de esta entrega

- Fidelidad y reconocimiento del mobiliario importado: issue #41, aplazada.
- Validación visual de renders generados con techo/luminarias; no realizada con
  servicios de pago en esta entrega.

---

**Inicio del proyecto:** 2026-06-16 | **Versión:** 0.0.0 (pre-alpha) | **Equipo:** 7 roles (ARQ, BE, FE, IA, UX, QA, OPS)

### 2026-09-18 — Cerramientos por arrastre

- Vallas, cercas y setos se dibujan por extremos desde Construir, con lápiz, imanes y cota provisional; al terminar vuelve a selección.
- Cada tramo es una entidad editable; los postes y módulos vegetales se repiten según la longitud, también en tramos de 40 m.
- Verificación: pruebas de longitud, geometría repetida, extremos diagonales, persistencia y deshacer/rehacer.

### 2026-09-18 — Clics encadenados y cierre de contornos

- Paredes, muretes, vallas, cercas, setos y patios: primer clic inicia, siguientes confirman y continúan; cerrar termina automáticamente, Escape conserva los tramos abiertos.
- Patios poligonales con pavimento y sin techo; uniones de cerramientos por extremos admitidas sin permitir tramos duplicados ni cruces.
- Verificación: 781 pruebas del editor y banco real React/Konva en Chrome (cierre, continuación y Escape en seis herramientas).
- Propuesta pendiente: `plans/260918-0532-cerramientos-compuestos/plan.md`, puertas y composición muro/valla con postes circulares o rectangulares.
