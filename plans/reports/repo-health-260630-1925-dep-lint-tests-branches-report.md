# Repo Health Report — 2026-06-30 19:25

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| TypeScript | ✅ LIMPIO |
| Tests (Vitest) | ✅ 675/677 pasan, 2 skipped |
| ESLint | ❌ 29 errores, 15 warnings |
| Deps patch/minor | ⚠️ actualizables sin riesgo |
| Deps major | 🔴 TypeScript 6, ESLint 10 — requieren planificación |
| Working tree | ✅ sin cambios sin commitear |
| Ramas abiertas | ⚠️ 64 feature branches (muchas probablemente obsoletas) |

---

## 1. TypeScript

```
npx tsc --noEmit → sin salida (0 errores)
```

Sin errores de tipos. ✅

---

## 2. Tests

Runner: **Vitest** (`npm test` = `vitest run`).

```
94 passed | 2 skipped (96 archivos)
675 passed | 2 skipped (677 tests)
Duración: 16.6s
```

> **Nota**: `npx jest` falla completamente (96 suites caen). Jest no está configurado; el runner real es Vitest. No es un bug activo, pero confunde si alguien ejecuta `jest` directamente.

---

## 3. ESLint — 29 errores, 15 warnings

### Errores críticos

**A) `react-hooks/rules-of-hooks` — hook condicional (1 error, bug real)**

```
src/...  30:20  error  React Hook "useMemo" is called conditionally.
                       React Hooks must be called in the exact same order in every render.
```

Hooks condicionales rompen el orden de llamada en React. Puede causar crashes silenciosos o comportamiento indefinido en producción.

**B) `react-hooks/immutability` — mutación de variables post-render (17 errores)**

Ocurre en ficheros de canvas/3D donde se muta directamente `camera.near`, `camera.far`, valores de Three.js, etc. dentro de efectos o callbacks de React. Ejemplo:

```ts
cam.near = -200;  // ❌ camera cannot be modified
cam.far = 400;
```

Estos errores indican que el plugin de lint trata ciertos objetos como inmutables. En la práctica Three.js requiere mutar la cámara, pero el patrón correcto es usar `useRef` en lugar de reasignar variables locales de render.

**C) `react-hooks/set-state-in-effect` — setState síncrono en efecto (3 errores)**

```
src/components/wizard/step-style.tsx:104   → setSelection(sel)
src/.../algo.tsx:36                        → setState(...)
src/.../otro.tsx:43                        → setState(...)
```

`setState` llamado directamente en el cuerpo del efecto (no en callback) provoca renders en cascada. Riesgo: loops de render o comportamiento de UI errático.

**D) `useMemo` no utilizado importado**

```
src/...  12:10  warning  'useMemo' is defined but never used
```

Menor; limpieza de import.

### Warnings (15)

| Tipo | Count |
|------|-------|
| `no-unused-vars` (vars sin uso) | 6 |
| `exhaustive-deps` (deps faltantes en hooks) | 3 |
| `no-img-element` (`<img>` vs `<Image />` Next.js) | 1 (en 1 fichero) |
| `unused eslint-disable` | 1 |

---

## 4. Dependencias

### Patch — seguros, actualizar ya

| Paquete | Actual | Nueva |
|---------|--------|-------|
| `better-auth` | 1.6.20 | 1.6.23 |
| `radix-ui` | 1.6.0 | 1.6.1 |
| `react` + `react-dom` | 19.2.4 | 19.2.7 |
| `use-image` | 1.1.1 | 1.1.4 |

### Minor — probablemente seguros

| Paquete | Actual | Nueva | Nota |
|---------|--------|-------|------|
| `@aws-sdk/*` | 3.1073 | 3.1076 | seguro |
| `tailwindcss` + `@tailwindcss/postcss` | 4.1.18 | 4.3.2 | revisar changelog |
| `lucide-react` | 1.21 | 1.22 | seguro |
| `openai` | 6.44 | 6.45 | seguro |
| `pg` | 8.13.1 | 8.22.0 | revisar breaking changes |
| `prettier` | 3.8.4 | 3.9.4 | seguro |

### Major — PLANIFICAR, no actualizar sin revisión

| Paquete | Actual | Nueva | Riesgo |
|---------|--------|-------|--------|
| `typescript` | 5.9.3 | **6.0.3** | breaking changes de tipos |
| `eslint` | 9.39.4 | **10.6.0** | plugins pueden ser incompatibles |
| `dotenv` | 16.4.7 | **17.4.2** | revisar API |
| `@types/node` | 22.15 | **26.0.1** | posibles conflictos de tipos |

### Major v0 (Three.js)

| Paquete | Actual | Nueva |
|---------|--------|-------|
| `three` | 0.184 | 0.185 |
| `@types/three` | 0.184 | 0.185 |

Three.js cambia frecuentemente en versiones menores. Revisar changelog antes.

---

## 5. Ramas abiertas

**64 feature branches** en total. Ejemplos activos/recientes:

- `feat/2d-diferenciado-techo-pared`
- `feat/art-frame-imagen`
- `feat/canvas/cota-en-vivo`
- `feat/canvas/decoracion-materiales-luces`
- `feat/canvas/f2-vistas-por-imagen`
- `feat/canvas/f6-3d-navegable`
- `feat/canvas/formas-sala`
- `feat/canvas/menu-flotante-objeto`
- `feat/canvas/snapping-editar`
- `feat/contornos-no-ortogonales`
- `feat/drag-luz-techo`
- `feat/handles-muros-plantilla-drawn` / `feat/handles-todos-muros`
- `feat/glb-custom-3d`
- … (muchas más)

La mayoría probablemente son ramas de trabajo sin merge o experimentos abandonados. Conviene hacer limpieza periódica.

---

## Siguiente acción recomendada

**Prioridad alta:**

1. **Corregir `useMemo` condicional** — es un bug real de React, no solo lint. Buscar el fichero con el hook condicional en línea 30 y refactorizarlo para que el hook esté siempre en el top-level del componente.

2. **Corregir los 3 `setState` en cuerpo de efecto** — especialmente `wizard/step-style.tsx:104`. La solución habitual es inicializar el estado directamente (`useState(defaultSelection('salon'))`) en lugar de setearlo en un efecto vacío.

**Prioridad media:**

3. **Actualizar deps patch** — `react`, `react-dom`, `better-auth`, `radix-ui`, `use-image` en un solo commit.

4. **Limpiar ramas obsoletas** — revisar las 64 feature branches y archivar/borrar las que ya están mergeadas o abandonadas.

**Planificar (no urgente):**

5. **Actualizar minor deps** — tailwindcss 4.3, openai 6.45, pg 8.22. Testear con vitest tras actualizar.

6. **Upgrade major (TypeScript 6 + ESLint 10)** — planificar como issue dedicado; requiere validar plugins de ESLint y posibles cambios de tipos.

---

## Preguntas abiertas

- ¿Las ramas `feat/canvas/*` están previstas para merge en `develop` próximamente o son experimentales descartadas?
- ¿Hay plan para address los errores de `immutability` en el canvas 3D, o se considera acceptable suprimir esas reglas donde Three.js requiere mutación directa?
