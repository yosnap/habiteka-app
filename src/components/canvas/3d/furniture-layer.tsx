'use client';

/**
 * Capa de muebles de la escena 3D (F6.2). Por cada `FurnitureItem` (ya posicionado en
 * metros por `docToScene`): si su kind tiene modelo glTF en el mapa, lo carga y lo
 * normaliza a las medidas reales del objeto; si no, dibuja un placeholder (caja
 * etiquetada por color de categoría) — patrón análogo al `default` de `object-shapes` en 2D.
 */
import { Suspense, useMemo } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { FurnitureItem } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl, furnitureFrontAngle, hasFront } from '@/canvas/3d/furniture-models';
import type { StructKind } from '@/canvas/types';
import { CATALOG } from '@/canvas/catalog';

/** Color de placeholder por categoría del catálogo (cae a un gris neutro). */
const CATEGORY_COLOR: Record<string, string> = {
  estructura: '#b7c3cf',
  sanitarios: '#cfe3ec',
  cocina: '#e6d7c3',
  mobiliario: '#d9c9b0',
  electronica: '#c9c2d6',
  decoracion: '#c7ddc7',
  iluminacion: '#f0e4b8',
};

/** Índice kind → id de categoría, derivado del catálogo (una sola fuente de verdad). */
const KIND_TO_CATEGORY: Partial<Record<StructKind, string>> = Object.fromEntries(
  CATALOG.flatMap((c) => c.items.map((it) => [it.kind, c.id])),
);

function placeholderColor(kind: StructKind): string {
  const cat = KIND_TO_CATEGORY[kind];
  return (cat && CATEGORY_COLOR[cat]) || '#cbb89a';
}

/**
 * Modelo glTF de un mueble, normalizado: el glTF viene en su propia escala/origen, así
 * que medimos su bounding box (sobre la escena ORIGINAL) y lo escalamos (no uniforme) a
 * las medidas reales del objeto (`item.size`), lo apoyamos en el suelo y lo colocamos/
 * rotamos. `flipX` lo refleja en X (espejo), como en el plano 2D. Se instancia con
 * `<Clone>` de drei: clona el glTF compartido por instancia Y libera el clon al
 * desmontar (evita acumular geometrías/materiales en GPU al reabrir el 3D).
 */
function FurnitureModel({ item, url }: { item: FurnitureItem; url: string }) {
  const { scene } = useGLTF(url);
  const transform = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const dim = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // Orientación del modelo (giro en Y, múltiplo de 90°) para que quede colocado correctamente:
    //  - Si el modelo DECLARA su frente (`front`), se usa ese dato: el frente del glTF se lleva a
    //    +Z (la dirección que el editor toma como "de frente"). Esto fija también el SENTIDO
    //    (cabecero vs piecero), que la sola proporción del bbox no puede distinguir.
    //  - Si no lo declara, se infiere por PROPORCIÓN: se gira 90° si la apaisadura del modelo y la
    //    del objeto del plano discrepan, para alinear los lados largos. Orienta el eje, no el sentido.
    // En ambos casos es automático: ningún ángulo se calibra a mano en el render.
    let modelRot: number; // rad, múltiplo de π/2
    if (hasFront(item.kind)) {
      modelRot = -furnitureFrontAngle(item.kind);
    } else {
      const modelLandscape = dim.x >= dim.z;
      const itemLandscape = item.size[0] >= item.size[2];
      modelRot = modelLandscape !== itemLandscape ? Math.PI / 2 : 0;
    }
    // ¿El giro intercambia los ejes X↔Z del modelo? (90° o 270°). Afecta a qué medida del modelo
    // se escala con el ancho del objeto y cuál con el fondo.
    const swap = Math.abs(Math.round(Math.sin(modelRot))) === 1;
    const modelW = swap ? dim.z : dim.x;
    const modelD = swap ? dim.x : dim.z;
    const sx = (modelW > 0 ? item.size[0] / modelW : 1) * (item.flipX ? -1 : 1);
    const sy = dim.y > 0 ? item.size[1] / dim.y : 1;
    const sz = modelD > 0 ? item.size[2] / modelD : 1;

    return {
      modelRot,
      // Escala en los ejes del MODELO (antes del giro): si intercambia ejes, el ancho del objeto
      // escala el eje Z del modelo y el fondo el eje X.
      scale: (swap ? [sz, sy, sx] : [sx, sy, sz]) as [number, number, number],
      // Recentrar en X/Z (ejes del modelo) y apoyar la base en y=0.
      offset: (swap
        ? [-center.z * sz, -box.min.y * sy, -center.x * sx]
        : [-center.x * sx, -box.min.y * sy, -center.z * sz]) as [number, number, number],
    };
  }, [scene, item.size, item.flipX, item.kind]);

  // El grupo se ancla en el SUELO (y=0), no en item.center[1] (=altura/2): el offset
  // interior ya apoya la base del modelo en y=0 local. Usar item.center[1] sumaría
  // media altura y dejaría el mueble flotando. La caja-placeholder sí usa center[1]
  // porque boxGeometry se centra en su origen.
  return (
    <group position={[item.center[0], 0, item.center[2]]} rotation={[0, item.rotationY, 0]}>
      <group rotation={[0, transform.modelRot, 0]}>
        <group scale={transform.scale} position={transform.offset}>
          <Clone object={scene} />
        </group>
      </group>
    </group>
  );
}

/** Caja a escala real, coloreada por categoría, para kinds sin modelo glTF. */
function FurniturePlaceholder({ item }: { item: FurnitureItem }) {
  return (
    <mesh position={item.center} rotation={[0, item.rotationY, 0]}>
      <boxGeometry args={item.size} />
      <meshStandardMaterial color={placeholderColor(item.kind)} transparent opacity={0.85} />
    </mesh>
  );
}

/** Renderiza todos los muebles: modelo glTF si existe, si no placeholder. */
export function FurnitureLayer({ items }: { items: FurnitureItem[] }) {
  return (
    <group>
      {items.map((item) => {
        const url = furnitureModelUrl(item.kind);
        if (!url) return <FurniturePlaceholder key={item.id} item={item} />;
        // El placeholder sirve de fallback mientras el glTF carga (Suspense).
        return (
          <Suspense key={item.id} fallback={<FurniturePlaceholder item={item} />}>
            <FurnitureModel item={item} url={url} />
          </Suspense>
        );
      })}
    </group>
  );
}
