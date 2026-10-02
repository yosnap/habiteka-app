# Documentación de Habiteka: desarrollo, publicación y mantenimiento

ESLint excluye `docs/site/` (validado con Astro) y `public/documentacion/` (HTML y JavaScript generados). Compilar la guía antes de lint no introduce comprobaciones sobre el código de terceros generado; el código fuente de la aplicación conserva sus reglas.

## Un repositorio y un despliegue

La guía pública se escribe en `docs/site/src/content/docs/`. Astro Starlight compila esos archivos a HTML, CSS, JavaScript e índice de búsqueda. El resultado se incorpora a `public/documentacion/` y **lo sirve el mismo Next.js de Habiteka**.

`docs/site/package.json` aísla las dependencias del compilador de documentación de React/Next. Es una herramienta de build dentro del repositorio, no otro servidor de producción, servicio de Astro, aplicación desplegada o repositorio. No hay configuración de Workers/Pages ni despliegue independiente.

Dominio público: **https://docs.habiteka.app**, publicado y verificado por HTTPS el 2 de octubre de 2026. `next.config.ts` reescribe las peticiones de ese host hacia los archivos estáticos; el dominio principal conserva sus rutas. En desarrollo se admite **http://docs.localhost:3040** en el mismo servidor.

## Instalación local

Requisito del compilador: Node >=22.12.0.

```sh
npm ci --prefix docs/site
npm run docs:build
```

Usa los comandos habituales de instalación de Habiteka para las dependencias de la aplicación. El compilador tiene su propio `package-lock.json` reproducible; no altera el lockfile de dependencias de la aplicación.

Si instalas la aplicación con pnpm, `pnpm-workspace.yaml` autoriza los scripts de instalación de `@prisma/engines`, `prisma`, `sharp` y `unrs-resolver` con valores booleanos. Esta configuración mantiene disponibles Prisma y las dependencias nativas; el flujo de usuario sigue igual.

## Trabajar en la guía

```sh
npm run docs:dev
```

La vista de edición de Astro abre en `http://localhost:4321` y recarga al modificar contenido. Ese proceso es solo para desarrollar documentación; no existe en producción. El índice de búsqueda se genera en build: verifícalo en la salida compilada.

Para comprobar la integración real:

```sh
npm run docs:build
npm run dev
```

Abre `http://docs.localhost:3040`: mismos proceso y puerto que la aplicación. Después de editar las guías, vuelve a compilar para renovar esta salida estática.

## Compilación y contenedor

- `npm run build`: comprueba/compila Starlight, copia su salida pública y construye Next.js.
- `npm run build:app`: solo Next; se usa en Docker después de generar la documentación en otra etapa del mismo Dockerfile.
- Docker utiliza una etapa Node para compilar Starlight y copia los archivos al builder de Habiteka. El runner contiene esos assets públicos, pero no necesita Astro ni su node_modules.
- `.dockerignore` permite la fuente de `docs/site/` y excluye sus dependencias/salidas locales. Los assets se reconstruyen; no se versionan.
- No se publica automáticamente por cambiar guías en disco: entran en el siguiente despliegue normal del mismo repositorio y rama.

## Vincular el dominio en el despliegue existente

1. En el servicio actual de Habiteka en Dokploy, añade `docs.habiteka.app` como **otro dominio del mismo servicio**, apuntando al mismo puerto 3000.
2. En el proveedor DNS que gestione el dominio (actualmente Hostinger), crea el registro DNS de ese subdominio hacia el destino que ya usa la aplicación. No hace falta crear otro proyecto ni servidor para la documentación.
3. Mantén el hostname `docs.habiteka.app` en la petición que llega a Next; el routing distingue documentación por el host.
4. Configura TLS/HTTPS en el proxy del servicio con el procedimiento existente.
5. Publica el mismo repositorio/rama por su flujo habitual y comprueba portada, página interior, CSS, búsqueda y que el dominio principal sigue mostrando la app.

La configuración del repositorio no crea por sí sola DNS ni el dominio de Dokploy. No marques la publicación como terminada hasta comprobar el HTTPS público.

## Estructura del manual

La cabecera personalizada en `docs/site/src/components/docs-header.astro` mantiene visibles los iconos sol/luna/pantalla en escritorio y móvil. `theme-icon-picker.astro` utiliza la preferencia `starlight-theme` para conservar el tema y seguir los cambios del sistema en modo automático. Las capturas de menús se incorporarán al estabilizar sus flujos; las guías actuales dan pasos con los nombres reales de botones.

| Carpeta | Contenido |
|---|---|
| `guias/` | Proyecto, importación, guardado, parcela e imágenes |
| `editor/` | Herramientas, atajos, techos y luces |
| `videos/` | Modalidades, montaje, recorrido y promoción |
| `ayuda/` | Problemas, estado y novedades |

Cada página lleva `title` y `description` en frontmatter. Si añades una página, inclúyela en el sidebar de `astro.config.mjs` y enlázala desde el flujo correspondiente. Las URLs internas parten de `/`, ya que el subdominio sirve la guía en su raíz.

La antigua `docs/guia-de-uso.md` queda como instantánea inicial. La guía pública vigente se mantiene en Starlight. `/ayuda` enlaza al manual y conserva la referencia rápida de atajos dentro de la aplicación.

## Regla de actualización obligatoria

La regla del repositorio está en `AGENTS.md` y `docs/code-standards.md`: cada implementación, modificación o corrección actualiza la documentación afectada en el mismo cambio.

1. Identifica qué guía, herramienta, atajo, opción, límite o error cambia.
2. Actualiza las instrucciones y los nombres reales de los botones. Marca funciones pendientes y documenta novedades cuando cambie una capacidad.
3. Para cambios puramente técnicos, actualiza la documentación técnica. El gate conservador exige también una página pública para cambios en `src/` o `prisma/`; si el comportamiento visible no cambia, explica ese hecho de forma pertinente en la guía afectada.
4. No publiques datos privados, ubicaciones reales de usuarios ni secretos como ejemplos.
5. Ejecuta la comprobación y el build antes de terminar.

```sh
npm run docs:updates
npm run docs:updates -- --staged
npm run docs:updates -- --base develop
npm run docs:build
```

El gate detecta presencia de documentación en el cambio, incluyendo archivos nuevos locales. Con `--staged` revisa solo el commit preparado; con `--base` revisa cambios ya commiteados desde el ancestro común. Eliminar documentación no cumple el requisito. Los reportes de `plans/` tampoco lo cumplen.

CI incorpora el gate y compila la documentación con el build de Habiteka. La comprobación no puede decidir si la explicación es correcta: la revisión debe contrastarla con la implementación y los atajos de `src/canvas/editor-v2/editor-shortcuts.ts`.

## Fuentes de implementación

Configuración según [Starlight: instalación manual](https://starlight.astro.build/manual-setup/) y [referencia de configuración](https://starlight.astro.build/reference/configuration/). La guía pública se genera estáticamente; su hosting en este proyecto lo realiza Next.js, dentro del despliegue actual.

## Publicación verificada — 2 de octubre de 2026

El DNS de Hostinger y el dominio adicional del mismo servicio de Dokploy están configurados. La documentación se sirve desde el mismo despliegue de Habiteka, sin una aplicación separada.

Se verificaron por HTTPS la portada, `/videos/tipos/`, los estilos CSS y el JavaScript de búsqueda de Pagefind, con respuestas 200. Esta comprobación pública confirma la publicación de `https://docs.habiteka.app`.
