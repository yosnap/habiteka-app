# Home centrada en el producto

Estado: implementada en `feat/home-producto` (24/10/2026), sin fusionar. Tras la primera versión, Paulo
pidió una home mucho más viva: se rediseñó con escena oscura, animaciones (`motion`), demo de plano
interactiva, comparador, 3D girable, vídeos simulados y seis ejemplos ilustrativos inventados (autorizados
y rotulados). Pendiente: sustituir los ejemplos por diseños reales aceptados y el texto de la asociación.

## Resultado buscado

Una home pública que explique qué hace Habiteka, de principio a fin, con muchos ejemplos visuales reales.
Sin precios ni planes. Base para presentar el proyecto (subvenciones, licitaciones, asociación) y para
enlazar más adelante los vídeos de ayuda.

## Restricciones

- Solo funciones reales, tomadas de la guía de usuario (`docs/site/src/content/docs/`). Lo pendiente
  (visita virtual continua, promoción geográfica continua) no se anuncia o se marca como «en desarrollo».
- Ejemplos con imágenes reales: diseños IA **aceptados** y capturas de la interfaz. El plano y su 3D
  solo aparecen como «herramienta de trabajo», nunca como resultado final.
- Nada de ilustraciones vectoriales ni emojis como imagen de función (los emojis actuales se quitan);
  solo iconos de botón. Sin prueba social inventada. Sin bordes de acento laterales.
- No prometer «usa tus propias claves» hasta que exista. Ficheros < 1000 líneas, componentes pequeños.
- Rendimiento: imágenes en AVIF/WebP con `next/image`, Lighthouse móvil ≥ 90.

## Estructura propuesta

1. **Hero**: «Del plano a tu casa terminada, antes de mover un ladrillo». Imagen grande de un diseño
   aceptado + mini secuencia plano → diseño. CTA «Crear cuenta» y «Ver cómo funciona».
2. **El recorrido en 5 pasos** (con captura real en cada paso): importar el plano (foto, boceto, CAD o
   PDF) y revisar cotas → completar el inmueble en el editor 2D/3D → diseñar con IA → aprobar y aceptar
   diseños → imágenes y vídeos.
3. **Importa tu plano**: antes/después (foto del plano → plano editable con cotas por estancia). Lectura
   revisada por Jev y redibujado técnico cuando hace falta.
4. **Editor profesional**: Plano 2D, Amueblado y Modelo 3D; catálogo realista por habitaciones,
   acabados, techos y luces, tejados (una, dos o cuatro aguas, lucernarios), grupos y paquetes
   reutilizables, plantas apiladas o separadas, caminar por el plano.
5. **Diseños con IA fieles a tu plano**: galería de ejemplos por estancia (salón, cocina, baño,
   dormitorio, exterior, cenital completa). Retoques por zona que conservan el resto de la imagen.
6. **Tu casa en su parcela real**: ortofoto IGN/PNOA, encaje a escala, orientación y sol, tapar la
   construcción actual. Antes/después.
7. **Vídeos para presentar**: montaje publicitario 16:9 y 9:16 con cotas, construcción (piloto) y paseo
   en primera persona, con clips cortos reales.
8. **Control y fiabilidad**: aprobación de versiones, aceptación explícita de cada diseño, revisión
   automática de puertas y huecos, historial, exportar/importar proyecto `.habiteka`.
9. **Proyecto abierto / asociación**: quién está detrás y para qué (texto que aporte Paulo).
10. **Preguntas frecuentes** y **CTA final**; pie con guía de usuario (docs.habiteka.app) y legales.

## Fases

1. Componentes y textos con huecos de imagen declarados (sin imágenes falsas).
2. Recopilar y optimizar imágenes/clips aprobados por Paulo en `public/landing/`.
3. Verificación visual (escritorio y 375 px), Lighthouse, documentación (novedades).

## Preguntas abiertas

- De qué proyectos salen los ejemplos y si se pueden publicar.
- Texto de la sección «Proyecto abierto / asociación».
- Si hay vídeos cortos ya generados y aceptados que se puedan usar.
