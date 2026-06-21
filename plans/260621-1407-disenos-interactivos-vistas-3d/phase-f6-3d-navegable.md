# F6 · 3D navegable real (Three.js / React Three Fiber)

**Estado: 📋 PLANIFICADA (research hecho). NO implementada — es XL, requiere su propio ciclo.**
Etapa C. Es la respuesta correcta a la necesidad que F2 (vistas por imagen) NO pudo cubrir: una
vista navegable FIEL solo se logra con geometría 3D real, no con un modelo de imagen 2D.

## Por qué F6 y no F2

El spike de F2 demostró (3 modelos, 4 iteraciones) que un modelo de imagen no reconstruye otra
cámara desde una referencia cenital: alucina la disposición. En F6 el plano se convierte en una
ESCENA 3D real (muros, suelo, muebles como mallas) y la cámara se mueve por geometría → vista
navegable fiel desde cualquier ángulo. La escala (F0) da las dimensiones reales y F-LUZ las luces.

## Research (resuelto)

- **Stack:** Three.js + React Three Fiber (R3F) + `@react-three/drei` (helpers: OrbitControls,
  PointerLockControls, useGLTF, Environment). Es el estándar React para 3D y encaja con Next.js
  (el canvas 3D se monta solo en cliente, `ssr: false`, como ya hace `canvas-stage`).
- **Modelos de muebles (incógnita CLAVE del plan, RESUELTA):** **Kenney "Furniture Kit"** — 140
  modelos glTF de mobiliario (sofás, mesas, sillas, camas, cocina, baño…), **licencia CC0** (uso
  comercial, sin atribución). Cubre casi todo el catálogo actual. Complementos CC0: Poly Pizza,
  Quaternius, Poly Haven (texturas/HDRI). Fuente: kenney.nl/assets/furniture-kit, poly.pizza.
- **glTF → componente:** `gltfjsx` convierte `.glb` en componentes R3F tipados (genera las mallas,
  luces, materiales). Pipeline de assets: descargar Kenney Kit → mapear cada `kind` del catálogo a
  su `.glb` → cargar con `useGLTF` (cacheado).
- **Mapeo doc→escena:** el `CanvasDoc` (px de stage + escala F0) se convierte a coordenadas 3D en
  metros: muros como cajas extruidas (alto de techo configurable), suelo como plano, cada `StructObj`
  → su modelo glTF posicionado/rotado/escalado por sus medidas reales. Las luces (F-LUZ) → luces
  de Three.js (color/intensidad → PointLight/SpotLight).
- **Cámara:** OrbitControls (órbita alrededor de la sala) para v1; PointerLock (primera persona,
  caminar) como v2. drei los provee.
- **Rendimiento:** instanciar/cachear modelos (`useGLTF.preload`), comprimir con Draco/meshopt,
  limitar nº de luces dinámicas. Medir en móvil (objetivo del producto).

## Incógnitas que quedan (para el research propio antes de implementar)

- Cobertura real catálogo↔Kenney: ¿qué kinds NO tienen modelo y necesitan placeholder o sustituto?
- Altura de techo y grosor de muro: ¿se infieren de la escala o el usuario los fija? (relación con F0).
- ¿v1 con OrbitControls basta para el valor de negocio, o se necesita primera persona ya?
- Peso del bundle 3D y los assets: ¿lazy-load del módulo 3D y de los glTF bajo demanda?
- ¿El 3D navegable sustituye o complementa al render fotorrealista de imagen (CRL-4)? (producto).

## Fases internas propuestas (cuando se ejecute, en su propio plan)

1. **Spike de viabilidad:** R3F + drei; renderizar una sala vacía (muros+suelo) desde un `CanvasDoc`
   con escala. Mide bundle, FPS en móvil, encaje con Next. Decide GO/NO-GO del stack.
2. **Pipeline de assets:** integrar Kenney Furniture Kit; mapear catálogo→glTF; cargador cacheado.
3. **doc→escena 3D:** conversión completa (muros, suelo, muebles con medidas reales, rotación/flip).
4. **Luces:** mapear `light` (F-LUZ) a luces Three.js (color/intensidad).
5. **Cámara y navegación:** OrbitControls (v1); PointerLock (v2).
6. **UI:** botón "Ver en 3D" en el editor del plano; vista a pantalla. Lazy-load del módulo 3D.
7. **Rendimiento + pulido:** Draco/meshopt, preload, límites de luces; medición.

## Riesgos

- **Muy alto / semanas.** No mezclar con otras fases. Necesita `/ck:research` (cobertura de modelos,
  rendimiento móvil) + `/ck:plan` con estas fases internas + `/ck:predict` (stack 3D, bundle).
- Dependencias nuevas pesadas (three, @react-three/fiber, @react-three/drei) → impacto en bundle:
  el módulo 3D debe ir lazy y aislado.
- Cobertura de modelos: si el catálogo crece con kinds sin glTF, hace falta política de placeholder.

## Aprovecha lo ya construido

- **F0 (escala):** da las medidas reales para construir la escena a escala.
- **F-CAT (catálogo declarativo):** cada kind ya es declarativo → mapear kind→glTF es declarativo.
- **F-LUZ (luces):** el modelo de luz (color/intensidad) ya existe → se traduce a luces Three.js.
- El patrón de montaje cliente-only (`dynamic ssr:false`) ya usado por `canvas-stage`.

## Fuera de alcance de ESTE documento

- Implementación. F6 se ejecuta en un plan propio tras aprobar el research. Aquí solo se deja el
  research hecho y el roadmap interno para arrancar con las incógnitas mayores resueltas.
