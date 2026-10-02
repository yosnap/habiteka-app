import type { EditorDocument } from './schema';
import { ceilingSurfaces, resolvedLuminaires, luminaireDepthMm, SPOT_CONE_DEG, DEFAULT_ROOF_THICKNESS_MM } from './ceiling-geometry';
import { resolvedStrips } from './light-strip-geometry';
import { exteriorRoofFootprints } from './exterior-roof-footprint';

const meters = (value: number) => Number((value / 1000).toFixed(3));

export const CEILING_RENDER_POLICY = `Los techos y luminarias indicados ya están aceptados y persistidos: conserva sus tipos, posiciones, alturas, acabados, caída, temperatura K, flujo lm y encendido. color es el acabado interior del techo; topMaterialId es el material de la cara superior exterior y edgeMaterialId el del canto exterior de la losa, cuando existan. roofTopM fija la cara superior exterior; el espesor se deduce desde heightM + dropM. El descenso de un falso techo solo afecta el interior. La transparencia del techo es solo una ayuda de edición, nunca un material de cristal. En cenital/isométrica/dron de estudio omite visualmente el techo y el tejado para ver el interior sin borrar luminarias; en vista interior representa el acabado real. No inventes techos ni cubras patios o terrazas abiertos. En modo estricto representa las luminarias existentes sin añadir otras; en modo controlado solo propón luces si additions incluye lights y dentro de las zonas autorizadas. positionM.elevation indica la cota inferior de la luminaria y bodyHeightM su altura; dropM es la caída desde el techo al cuerpo. El estilo no autoriza cambios geométricos. Una luminaria spot es un foco orientable: su haz de ${SPOT_CONE_DEG}° sale inclinado tiltDeg y girado azimuthDeg hasta el punto aimM del suelo, así que ilumina esa zona o ese paramento y nunca debe enderezarse hacia abajo. lightStrips son tiras LED lineales reales: respeta el recorrido pathM (o, si no lo lleva, el perímetro de su estancia o el frente del tramo de cocina), su cota elevationM, su dirección de emisión y su longitud, sin añadir ni quitar tiras ni convertirlas en luminarias puntuales. Cuando hay lightingScenes activas, la temperatura y el flujo de cada luz y cada tira ya llegan con la escena aplicada: represéntalos tal cual, sin volver a aplicar la intensidad de la escena.`;

/** Las mismas reglas, condensadas para el prompt compacto (tope de longitud de los modelos de respaldo). */
export const EXTERIOR_ROOF_RENDER_POLICY = 'exteriorRoof es el tejado exterior aprobado: conserva kind, pendiente pitchDeg, orientación orientationDeg, alero, espesor, acabado y huella con sus huecos. Sus boundaryM ya incluyen alero; no lo añadas otra vez. Los muros de sus estancias se prolongan desde su altura guardada hasta la cara inferior inclinada del tejado: reproduce esos hastiales y cierres con el acabado del muro, sin huecos entre pared y cubierta, sin crear nuevas ventanas. Respeta la visibilidad de camera: si ceilingView=hidden, oculta techo y tejado incluso en dron; en alzados con cutaway conserva la cubierta y oculta los cierres de los muros del lado de cámara. En exterior completo con cubierta visible conserva el tejado, sin sustituirlo por el falso techo. Estas ocultaciones no eliminan elementos del diseño. No cierres patios, ni elimines pérgolas u otros elementos aprobados.';
export const CEILING_RENDER_POLICY_COMPACT = 'Respeta techos/luces: tipo, altura, acabado, K, lm y estado. color=interior; topMaterialId=arriba; edgeMaterialId=canto exterior; roofTopM=cota superior; espesor=heightM+dropM. Falso techo baja solo dentro. Transparente=edición, nunca cristal. camera.ceilingView=hidden: oculta techo y exteriorRoof, también en dron. cutaway: oculta cierres del lado de cámara. Con cubierta visible conserva exteriorRoof con forma, pendiente, orientación, alero y huecos. Prolonga muros hasta el intradós inclinado con su mismo acabado; cierra hastiales sin ventanas nuevas ni espacios entre muro y cubierta. No cubras patios/terrazas ni elimines pérgolas. strict: sin luces nuevas; controlled: solo si additions incluye lights y en zonas autorizadas. positionM.elevation=cota inferior; dropM=caída. spot: haz hasta aimM. lightStrips: tiras LED lineales; conserva recorrido, cota, emisión y longitud. K/lm ya incluyen escena.';

/** Mismo contrato físico para diseño, render completo y render compacto. */
export function ceilingDesignContext(doc: EditorDocument) {
  return {
    ...(doc.exteriorRoof ? { exteriorRoof: { ...doc.exteriorRoof,
      eavesM: meters(doc.exteriorRoof.eavesMm), thicknessM: meters(doc.exteriorRoof.thicknessMm),
      footprints: exteriorRoofFootprints(doc).map(part => ({ baseM: meters(part.baseMm),
        boundaryM: part.rings.map(ring => ring.map(point => ({ x: meters(point.x), y: meters(point.y) }))) })),
    } } : {}),
    ceilings: ceilingSurfaces(doc).map(({ ceiling, room, heightMm }) => ({
      id: ceiling.id, roomId: room.id, kind: ceiling.kind,
      heightM: meters(heightMm), dropM: meters(ceiling.dropMm), color: ceiling.color,
      roofTopM: meters(heightMm + ceiling.dropMm + (ceiling.roofThicknessMm ?? DEFAULT_ROOF_THICKNESS_MM)),
      ...(ceiling.topMaterialId ? { topMaterialId: ceiling.topMaterialId } : {}),
      ...(ceiling.edgeMaterialId ? { edgeMaterialId: ceiling.edgeMaterialId } : {}),
      boundaryM: room.boundary.map((point) => ({ x: meters(point.x), y: meters(point.y) })),
    })),
    // Temperatura, flujo y encendido salen ya con la escena activa aplicada.
    luminaires: resolvedLuminaires(doc).map(({ luminaire, ceiling, heightMm, ceilingHeightMm, effectiveTemperatureK, effectiveLumens, effectiveEnabled, aim }) => ({
      id: luminaire.id, ceilingId: ceiling.id, roomId: ceiling.roomId, kind: luminaire.kind,
      positionM: { x: meters(luminaire.x), y: meters(luminaire.y), elevation: meters(heightMm) },
      bodyHeightM: meters(luminaireDepthMm(luminaire.kind, luminaire.mount)),
      ceilingHeightM: meters(ceilingHeightMm), dropM: meters(luminaire.dropMm), color: luminaire.color,
      temperatureK: effectiveTemperatureK, lumens: effectiveLumens, enabled: effectiveEnabled,
      // Orientación solo donde existe: el resto de tipos apunta siempre hacia abajo.
      ...(luminaire.kind === 'spot' ? {
        mount: luminaire.mount ?? 'surface',
        tiltDeg: Math.round(luminaire.tiltDeg ?? 0), azimuthDeg: Math.round(luminaire.azimuthDeg ?? 0),
        ...(aim ? { aimM: { x: meters(aim.x), y: meters(aim.y) } } : {}),
      } : {}),
    })),
    /**
     * Las derivadas no llevan `pathM`: su recorrido se deduce del contorno de la
     * estancia o del tramo de cocina, geometría que el prompt ya lleva.
     */
    lightStrips: resolvedStrips(doc).map(({ strip, pathMm, elevationMm, lengthMm, direction, roomId, effectiveTemperatureK, effectiveLumensPerMeter, effectiveEnabled }) => ({
      id: strip.id, roomId, kind: strip.kind, elevationM: meters(elevationMm),
      lengthM: meters(lengthMm), lumensPerMeter: effectiveLumensPerMeter,
      temperatureK: effectiveTemperatureK, enabled: effectiveEnabled, direction,
      ...(strip.derived ? {} : { pathM: pathMm.map((point) => ({ x: meters(point.x), y: meters(point.y) })) }),
    })),
    /**
     * Escena activa de cada estancia, solo descriptiva: sus valores ya están
     * aplicados en cada luz y cada tira. Las zonas de luces guardadas NO viajan:
     * son una herramienta de edición, no geometría del proyecto.
     */
    lightingScenes: (doc.lightingScenes ?? []).filter((scene) => scene.active).map((scene) => ({
      roomId: scene.roomId, name: scene.name,
      temperatureK: scene.temperatureK, intensityPct: scene.intensityPct,
    })),
  };
}
