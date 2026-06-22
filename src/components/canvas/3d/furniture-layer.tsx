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
import { furnitureModelUrl, furnitureFrontOffset } from '@/canvas/3d/furniture-models';
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
    // Escala no uniforme a las medidas del doc (ancho X, alto Y, fondo Z); X negativa
    // si el objeto está volteado en el plano.
    const sx = (dim.x > 0 ? item.size[0] / dim.x : 1) * (item.flipX ? -1 : 1);
    const sy = dim.y > 0 ? item.size[1] / dim.y : 1;
    const sz = dim.z > 0 ? item.size[2] / dim.z : 1;
    // Tras escalar, recentrar en X/Z y apoyar la base en y=0.
    return {
      scale: [sx, sy, sz] as [number, number, number],
      offset: [-center.x * sx, -box.min.y * sy, -center.z * sz] as [number, number, number],
    };
  }, [scene, item.size, item.flipX]);

  return (
    <group position={item.center} rotation={[0, item.rotationY + furnitureFrontOffset(item.kind), 0]}>
      <group scale={transform.scale} position={transform.offset}>
        <Clone object={scene} />
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
