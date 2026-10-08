# Revisión de Exterior y jardín

Fecha: 2026-10-05. Estado: diagnóstico y propuesta; las ampliaciones siguientes no están implementadas.

## Petición

Sustituir la apariencia de bloques del exterior por modelos realistas y ampliar árboles, setos, caminos,
superficies de asfalto, jardines y vehículos. El usuario señala piscina, estanque, barbacoa, setas y aspersores.

## Diagnóstico comprobado

- `outdoor-catalog.ts` contiene 31 entradas base y una variante de turismo. La UI filtra cuáles son construcción.
- `outdoor-volumes.ts` forma árboles, arbustos, setos, macetas, huerto y muchos otros objetos con prismas.
  Las fotos del catálogo renderizan esos volúmenes cuando no hay modelo: una foto de bloques sigue siendo bloques.
- `furniture-models.ts` no conecta modelos de jardín a estas entradas. El registro de la fábrica solo contiene
  `arbol_platano_400` de la familia jardín; existen especificaciones y constructores de más especies, sin completar
  su generación e integración. Faltan los módulos de macetas y piedras referidos por las especificaciones.
- `habiteka:outdoor:coche:turismo-3d` sí usa `road_saloon.glb`; el coche básico sigue con volúmenes. La existencia
  del GLB no demuestra calidad visual. Hay que inspeccionar y mejorar ambos, evitando duplicados confusos.
- Hay superficies rectangulares editables (`TerrainSurface`) y materiales básicos de tierra, gravilla, arena,
  corteza y asfalto. Césped y algunos pavimentos ya tienen mapas reales. No hay fichas directas para asfaltar una zona.
- Los setos nuevos son cerramientos dibujados por tramos. `addLinearBoundary` recibe solo `kind` y elige la primera
  entrada de ese tipo: añadir variantes al catálogo sin propagar su identificador perdería la especie elegida.

## Catálogo propuesto

| Familia | Primera selección propuesta |
| --- | --- |
| Árboles | Olivo, plátano de sombra, naranjo, pino, ciprés, palmera; variantes de tamaño coherentes |
| Setos y arbustos | Boj bajo, seto alto de ciprés, laurel, fotinia, arbusto redondo, lavanda, romero y gramíneas |
| Superficies | Asfaltado sin marcas, césped natural/artificial, grava clara/oscura, tierra compactada, arena y corteza |
| Caminos | Losas continuas, pasos separados sobre césped o grava, adoquín, grava y tierra; bordillo opcional |
| Jardines compuestos | Parterre de arbustos, jardín mediterráneo, rocalla, jardín florido y huerto en bancales |
| Agua | Piscina elevada con borde/escalera/revestimiento, estanque con borde irregular/plantas, fuente detallada |
| Equipamiento | Barbacoa de obra y de gas, macetas redondas y rectangulares, jardineras, aspersor emergente y de superficie, drenajes, setas cerámicas |
| Vehículos | Compacto, berlina, SUV y furgoneta sin marcas; carrocería curva, neumáticos, cristales y luces definidos |
| Sombra y cerramientos | Pérgolas de madera/metal, carpa, toldo, sombrilla y vallas con detalles de uniones, telas y herrajes |

Las especies y variantes son una propuesta de contenido, no recomendaciones agronómicas ni modelos disponibles.

## Interacción necesaria

- **Superficie:** dibujar la zona y elegir material. Asfalto debe cubrir una explanada completa, sin líneas de parking.
  Primera base reutilizable: rectángulos actuales. Polígonos irregulares requieren ampliar geometría, edición y guardado.
- **Camino:** dibujar recorrido y ancho, con material, separación de losas y bordes. Requiere una entidad de recorrido,
  no estirar un objeto rectangular. Validar giros cerrados, cruces y uniones de bordillos.
- **Bordes vegetales:** lado izquierdo/derecho/ambos, anchura y separación; césped, arbustos o flores.
- **Jardín compuesto:** colocar un conjunto coherente, pudiendo seleccionar y editar sus plantas por separado.
- **Seto:** mantener dibujo por clics y medidas editables; conservar especie y densidad al dibujar, duplicar y guardar.
- Separar geometría visual detallada y volúmenes simples de colisión. No bloquear pasos bajo pérgolas con su cubierta.
- Cambiar largo de camino/seto repite módulos; no estira hojas, piedras ni losas. Variaciones deterministas para que
  el jardín no cambie de aspecto al recargar. Modelos detallados cerca y simplificados a distancia.

## Orden de ejecución propuesto

1. Completar y conectar vegetación, macetas, jardineras, huerto y rocas; verificar sustitución en planos existentes.
2. Ofrecer superficies directas de asfalto, grava, tierra y césped con texturas reales y escala correcta.
3. Crear caminos trazables, bordes y jardines combinados editables.
4. Mejorar piscina, estanque, barbacoa, riego, vehículos y estructuras de sombra; retirar duplicados de catálogo
   conservando compatibilidad de los documentos antiguos.

## Aceptación

- La miniatura corresponde al modelo real que aparece en plano y 3D; no sustituir objetos deficientes solo por fotos.
- Vegetación con hojas, ramas y silueta orgánica; agua, piedra, tierra, metal y tejidos con acabados distinguibles.
- Revisar visualmente fichas y escena, cerca/lejos; medir carga con varios árboles y tramos largos de seto.
- Mantener cotas, posiciones, materiales y colisiones; comprobar guardado, deshacer, duplicar y documentos anteriores.
- Documentar cada función al implementarla en Starlight; no publicarla como disponible antes de terminarla.
- Modelos propios Blender o fuentes CC0 verificadas. Sin gasto IA ni aceptación de diseños en nombre del usuario.
- Todo esto sigue siendo la guía del editor; los entregables finales representan exclusivamente diseños IA aceptados.

## Preguntas pendientes

Ninguna bloquea el diagnóstico. La lista de especies y vehículos queda como propuesta, sujeta a revisión visual.
