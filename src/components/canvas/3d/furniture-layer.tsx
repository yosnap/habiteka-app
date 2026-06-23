'use client';

/**
 * Capa de muebles de la escena 3D (F6.2). Por cada `FurnitureItem` (ya posicionado en
 * metros por `docToScene`): si su kind tiene modelo glTF en el mapa, lo carga y lo
 * normaliza a las medidas reales del objeto; si no, dibuja un placeholder (caja
 * etiquetada por color de categoría) — patrón análogo al `default` de `object-shapes` en 2D.
 *
 * F1 (editor 3D interactivo): clic izquierdo selecciona; el objeto seleccionado muestra
 * una caja wireframe de selección y un menú flotante (via <Html> de drei) con acciones
 * Mover, Rotar, Duplicar, Eliminar.
 */
import { Suspense, useMemo } from 'react';
import { useGLTF, Clone, Html } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { FurnitureItem } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl, furnitureFrontAngle, hasFront } from '@/canvas/3d/furniture-models';
import type { StructKind } from '@/canvas/types';
import { CATALOG } from '@/canvas/catalog';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { SelectionMode } from './use-3d-selection';
import { ObjectFloatingMenu } from './object-floating-menu';

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

interface SelectionProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
}

/**
 * Caja wireframe + menú flotante sobre el objeto seleccionado.
 * Se monta DENTRO del grupo raíz del mueble (posición relativa al objeto).
 * La altura del ítem determina dónde aparece el menú (encima del techo del mueble).
 */
function SelectionOverlay({
  item,
  mode,
  onSetMode,
  onDeselect,
}: {
  item: FurnitureItem;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  onDeselect: () => void;
}) {
  const removeObject = useCanvasStore((s) => s.removeObject);
  const duplicateObjects = useCanvasStore((s) => s.duplicateObjects);

  const [w, h, d] = item.size;

  return (
    <>
      {/* Caja wireframe de selección centrada en el objeto */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <meshBasicMaterial color="#2196f3" wireframe />
      </mesh>

      {/* Menú flotante sobre el techo del mueble.
          pointerEvents:none en el wrapper de Html evita bloquear OrbitControls;
          el contenido interno lo restaura con pointerEvents:all. */}
      <Html
        center
        position={[0, h + 0.3, 0]}
        zIndexRange={[100, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <ObjectFloatingMenu
          mode={mode}
          onMove={() => onSetMode('translate')}
          onRotate={() => onSetMode('rotate')}
          onDuplicate={() => {
            duplicateObjects([item.id]);
          }}
          onDelete={() => {
            removeObject(item.id);
            onDeselect();
          }}
          onClose={onDeselect}
        />
      </Html>
    </>
  );
}

/**
 * Modelo glTF de un mueble, normalizado: el glTF viene en su propia escala/origen, así
 * que medimos su bounding box (sobre la escena ORIGINAL) y lo escalamos (no uniforme) a
 * las medidas reales del objeto (`item.size`), lo apoyamos en el suelo y lo colocamos/
 * rotamos. `flipX` lo refleja en X (espejo), como en el plano 2D. Se instancia con
 * `<Clone>` de drei: clona el glTF compartido por instancia Y libera el clon al
 * desmontar (evita acumular geometrías/materiales en GPU al reabrir el 3D).
 */
function FurnitureModel({
  item,
  url,
  sel,
}: {
  item: FurnitureItem;
  url: string;
  sel: SelectionProps;
}) {
  const { scene } = useGLTF(url);
  const transform = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const dim = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    let modelRot: number;
    if (hasFront(item.kind)) {
      modelRot = -furnitureFrontAngle(item.kind);
    } else {
      const modelLandscape = dim.x >= dim.z;
      const itemLandscape = item.size[0] >= item.size[2];
      modelRot = modelLandscape !== itemLandscape ? Math.PI / 2 : 0;
    }
    const swap = Math.abs(Math.round(Math.sin(modelRot))) === 1;
    const modelW = swap ? dim.z : dim.x;
    const modelD = swap ? dim.x : dim.z;
    const sx = (modelW > 0 ? item.size[0] / modelW : 1) * (item.flipX ? -1 : 1);
    const sy = dim.y > 0 ? item.size[1] / dim.y : 1;
    const sz = modelD > 0 ? item.size[2] / modelD : 1;

    return {
      modelRot,
      scale: (swap ? [sz, sy, sx] : [sx, sy, sz]) as [number, number, number],
      offset: (swap
        ? [-center.z * sz, -box.min.y * sy, -center.x * sx]
        : [-center.x * sx, -box.min.y * sy, -center.z * sz]) as [number, number, number],
    };
  }, [scene, item.size, item.flipX, item.kind]);

  const isSelected = sel.selectedId === item.id;

  return (
    <group
      name={item.id}
      position={[item.center[0], 0, item.center[2]]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        sel.onSelect(item.id);
      }}
    >
      <group rotation={[0, transform.modelRot, 0]}>
        <group scale={transform.scale} position={transform.offset}>
          <Clone object={scene} />
        </group>
      </group>
      {isSelected ? (
        <SelectionOverlay
          item={item}
          mode={sel.mode}
          onSetMode={sel.onSetMode}
          onDeselect={sel.onDeselect}
        />
      ) : null}
    </group>
  );
}

/** Caja a escala real, coloreada por categoría, para kinds sin modelo glTF. */
function FurniturePlaceholder({
  item,
  sel,
}: {
  item: FurnitureItem;
  sel: SelectionProps;
}) {
  const isSelected = sel.selectedId === item.id;

  return (
    <group
      name={item.id}
      position={[item.center[0], 0, item.center[2]]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        sel.onSelect(item.id);
      }}
    >
      <mesh position={[0, item.size[1] / 2, 0]}>
        <boxGeometry args={item.size} />
        <meshStandardMaterial
          color={placeholderColor(item.kind)}
          transparent
          opacity={0.85}
          emissive={isSelected ? '#1565c0' : undefined}
          emissiveIntensity={isSelected ? 0.25 : 0}
        />
      </mesh>
      {isSelected ? (
        <SelectionOverlay
          item={item}
          mode={sel.mode}
          onSetMode={sel.onSetMode}
          onDeselect={sel.onDeselect}
        />
      ) : null}
    </group>
  );
}

/** Renderiza todos los muebles: modelo glTF si existe, si no placeholder. */
export function FurnitureLayer({
  items,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
}: {
  items: FurnitureItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
}) {
  const sel: SelectionProps = { selectedId, onSelect, onDeselect, mode, onSetMode };

  return (
    <group>
      {items.map((item) => {
        const url = furnitureModelUrl(item.kind);
        if (!url) {
          return <FurniturePlaceholder key={item.id} item={item} sel={sel} />;
        }
        return (
          <Suspense key={item.id} fallback={<FurniturePlaceholder item={item} sel={sel} />}>
            <FurnitureModel item={item} url={url} sel={sel} />
          </Suspense>
        );
      })}
    </group>
  );
}
