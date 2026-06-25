'use client';

/**
 * Capa de muebles de la escena 3D (F6.2). Por cada `FurnitureItem` (ya posicionado en
 * metros por `docToScene`): si su kind tiene modelo glTF en el mapa, lo carga y lo
 * normaliza a las medidas reales del objeto; si no, dibuja un placeholder (caja
 * etiquetada por color de categoría).
 *
 * Drag-to-move: cuando un mueble está seleccionado, arrastrarlo directamente lo mueve
 * sobre el plano XZ (suelo). OrbitControls se desactiva durante el drag y se reactiva
 * al soltar, sin necesidad de activar el gizmo de transformación explícitamente.
 *
 * Snap a paredes: al arrastrar, si el borde del mueble se acerca a < SNAP_DIST de
 * una cara de muro, el mueble se adhiere y se muestra un indicador visual azul.
 *
 * Elevación automática: al soltar sobre otro mueble, se calcula la elevación para
 * que el objeto quede apoyado encima (p.ej. TV sobre estantería).
 */
import { Suspense, useMemo, memo, useRef, useEffect, useCallback } from 'react';
import { useGLTF, Clone, Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Box3, Vector3, Group, Raycaster, Plane, Vector2, type Mesh } from 'three';
import type { FurnitureItem, WallBox } from '@/canvas/3d/doc-to-scene';
import { furnitureModelUrl, furnitureFrontAngle, hasFront } from '@/canvas/3d/furniture-models';
import type { StructKind } from '@/canvas/types';
import { CATALOG } from '@/canvas/catalog';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { SelectionMode } from './use-3d-selection';
import type { SceneCoords } from '@/canvas/3d/scene-to-doc';
import { translatePatch } from '@/canvas/3d/scene-to-doc';
import { buildFloorAABB, resolveFloorCollisions } from '@/canvas/3d/collision';
import { isFloorCollidable } from '@/canvas/3d/placement';
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

// ── Snap a paredes + guías de alineación ────────────────────────────────────

const SNAP_DIST = 0.12; // 12 cm de zona de atracción y alineación

type SnapState = { axis: 'x' | 'z'; side: number } | null;

/** Datos de guía de alineación entre muebles (compartido con SnapGuideLayer). */
export type SnapGuideData = { alignX?: number; alignZ?: number } | null;

/**
 * Calcula si algún borde del mueble está dentro de SNAP_DIST de la CARA INTERIOR
 * del muro más próximo. Solo maneja muros alineados con los ejes (rotationY ≈ 0 o π/2).
 * Usa la posición del mueble respecto al centro del muro para saber qué cara es
 * la interior (la que da al interior de la sala), evitando que el mueble quede
 * incrustado en la pared.
 */
function computeWallSnap(
  objX: number,
  objZ: number,
  hw: number, // half-width del mueble en X
  hd: number, // half-depth del mueble en Z
  walls: WallBox[],
): { snappedX: number; snappedZ: number; snap: SnapState } {
  let snappedX = objX;
  let snappedZ = objZ;
  let snap: SnapState = null;

  for (const w of walls) {
    const cosAbs = Math.abs(Math.cos(w.rotationY));
    const sinAbs = Math.abs(Math.sin(w.rotationY));

    if (cosAbs > 0.85) {
      // Muro a lo largo del eje X (rotationY ≈ 0 o π)
      const wallHW = w.size[0] / 2;
      const wallHD = w.size[2] / 2;
      if (objX + hw <= w.center[0] - wallHW || objX - hw >= w.center[0] + wallHW) continue;

      if (objZ > w.center[2]) {
        // Mueble al sur del muro: su cara norte toca la cara interior sur del muro
        const zInner = w.center[2] + wallHD;
        if (Math.abs(objZ - hd - zInner) < SNAP_DIST) {
          snappedZ = zInner + hd; snap = { axis: 'z', side: -1 }; break;
        }
      } else {
        // Mueble al norte del muro: su cara sur toca la cara interior norte del muro
        const zInner = w.center[2] - wallHD;
        if (Math.abs(objZ + hd - zInner) < SNAP_DIST) {
          snappedZ = zInner - hd; snap = { axis: 'z', side: 1 }; break;
        }
      }
    }

    if (sinAbs > 0.85) {
      // Muro a lo largo del eje Z (rotationY ≈ π/2 o 3π/2)
      const wallHW = w.size[0] / 2;
      const wallHD = w.size[2] / 2;
      if (objZ + hd <= w.center[2] - wallHW || objZ - hd >= w.center[2] + wallHW) continue;

      if (objX > w.center[0]) {
        // Mueble al este del muro: su cara oeste toca la cara interior este del muro
        const xInner = w.center[0] + wallHD;
        if (Math.abs(objX - hw - xInner) < SNAP_DIST) {
          snappedX = xInner + hw; snap = { axis: 'x', side: -1 }; break;
        }
      } else {
        // Mueble al oeste del muro: su cara este toca la cara interior oeste del muro
        const xInner = w.center[0] - wallHD;
        if (Math.abs(objX + hw - xInner) < SNAP_DIST) {
          snappedX = xInner - hw; snap = { axis: 'x', side: 1 }; break;
        }
      }
    }
  }

  return { snappedX, snappedZ, snap };
}

/**
 * Alineación con otros muebles: centro-centro y bordes homólogos / enfrentados.
 * Devuelve la posición corregida y las coordenadas mundiales de las guías a mostrar.
 */
function computeAlignmentSnap(
  objX: number,
  objZ: number,
  hw: number,
  hd: number,
  itemId: string,
  others: FurnitureItem[],
): { snappedX: number; snappedZ: number; alignX?: number; alignZ?: number } {
  let snappedX = objX;
  let snappedZ = objZ;
  let alignX: number | undefined;
  let alignZ: number | undefined;

  for (const other of others) {
    if (other.id === itemId) continue;
    const ocx = other.center[0];
    const ocz = other.center[2];
    const ohw = other.size[0] / 2;
    const ohd = other.size[2] / 2;

    if (alignX === undefined) {
      const xPairs: [number, number][] = [
        [objX, ocx],
        [objX - hw, ocx - ohw],
        [objX + hw, ocx + ohw],
        [objX - hw, ocx + ohw],
        [objX + hw, ocx - ohw],
      ];
      for (const [a, b] of xPairs) {
        if (Math.abs(a - b) < SNAP_DIST) { snappedX += b - a; alignX = b; break; }
      }
    }

    if (alignZ === undefined) {
      const zPairs: [number, number][] = [
        [objZ, ocz],
        [objZ - hd, ocz - ohd],
        [objZ + hd, ocz + ohd],
        [objZ - hd, ocz + ohd],
        [objZ + hd, ocz - ohd],
      ];
      for (const [a, b] of zPairs) {
        if (Math.abs(a - b) < SNAP_DIST) { snappedZ += b - a; alignZ = b; break; }
      }
    }

    if (alignX !== undefined && alignZ !== undefined) break;
  }

  return { snappedX, snappedZ, alignX, alignZ };
}

/**
 * Clamp de seguridad: asegura que el mueble no penetre ninguna pared.
 * Se aplica después del snap de alineación para que las guías de alineación
 * no puedan incrustarlo en un muro (p. ej. alinear centro-centro con un
 * mueble pegado a la pared).
 */
function clampToWalls(
  objX: number, objZ: number, hw: number, hd: number, walls: WallBox[],
): [number, number] {
  let x = objX;
  let z = objZ;
  for (const w of walls) {
    const cosAbs = Math.abs(Math.cos(w.rotationY));
    const sinAbs = Math.abs(Math.sin(w.rotationY));
    if (cosAbs > 0.85) {
      const wallHW = w.size[0] / 2;
      const wallHD = w.size[2] / 2;
      if (x + hw <= w.center[0] - wallHW || x - hw >= w.center[0] + wallHW) continue;
      if (z > w.center[2]) {
        const zInner = w.center[2] + wallHD;
        if (z - hd < zInner) z = zInner + hd;
      } else {
        const zInner = w.center[2] - wallHD;
        if (z + hd > zInner) z = zInner - hd;
      }
    }
    if (sinAbs > 0.85) {
      const wallHW = w.size[0] / 2;
      const wallHD = w.size[2] / 2;
      if (z + hd <= w.center[2] - wallHW || z - hd >= w.center[2] + wallHW) continue;
      if (x > w.center[0]) {
        const xInner = w.center[0] + wallHD;
        if (x - hw < xInner) x = xInner + hw;
      } else {
        const xInner = w.center[0] - wallHD;
        if (x + hw > xInner) x = xInner - hw;
      }
    }
  }
  return [x, z];
}

// ── Elevación automática al apilar ──────────────────────────────────────────

/**
 * Si el mueble (en posición finalX/Z) solapa en XZ con otro mueble,
 * devuelve la altura de la superficie superior de ese mueble (→ elevationM).
 * Si no hay solapamiento, devuelve 0 (suelo).
 */
function computeAutoElevation(
  finalX: number,
  finalZ: number,
  hw: number,
  hd: number,
  itemId: string,
  others: FurnitureItem[],
): number {
  let maxTop = 0;
  for (const other of others) {
    if (other.id === itemId) continue;
    const ohw = other.size[0] / 2;
    const ohd = other.size[2] / 2;
    const overlapX = Math.abs(finalX - other.center[0]) < hw + ohw - 0.02;
    const overlapZ = Math.abs(finalZ - other.center[2]) < hd + ohd - 0.02;
    if (overlapX && overlapZ) {
      const top = other.floorElevationM + other.size[1];
      if (top > maxTop) maxTop = top;
    }
  }
  return maxTop;
}

// ── Hook de arrastre ────────────────────────────────────────────────────────

interface SelectionProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  onSwap?: (id: string) => void;
  walls: WallBox[];
  items: FurnitureItem[];
  snapGuideRef?: React.MutableRefObject<SnapGuideData>;
}

/**
 * Drag-to-move sobre el plano del suelo. Cuando el mueble está seleccionado, arrastrarlo
 * mueve su grupo Three.js directamente (sin React state) y persiste al store al soltar.
 * OrbitControls se deshabilita durante el drag y se reactiva en pointerup.
 * Aplica snap a muros durante el arrastre y auto-elevación al soltar.
 */
function useDragOnFloor({
  groupRef,
  item,
  isSelected,
  sceneCoords,
  walls,
  items,
  snapStateRef,
  snapGuideRef,
}: {
  groupRef: React.RefObject<Group | null>;
  item: FurnitureItem;
  isSelected: boolean;
  sceneCoords: SceneCoords;
  walls: WallBox[];
  items: FurnitureItem[];
  snapStateRef: React.MutableRefObject<SnapState>;
  snapGuideRef?: React.MutableRefObject<SnapGuideData>;
}) {
  const { camera, gl } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startFloorXZ: [number, number];
    startObjXZ: [number, number];
  } | null>(null);

  const hw = item.size[0] / 2;
  const hd = item.size[2] / 2;

  /** Intersecta el rayo desde la cámara con el plano del suelo del mueble. */
  const hitFloor = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      const plane = new Plane(new Vector3(0, 1, 0), -item.floorElevationM);
      const target = new Vector3();
      return raycaster.ray.intersectPlane(plane, target) ? [target.x, target.z] : null;
    },
    [camera, gl, item.floorElevationM],
  );

  /** Listeners de DOM para pointermove/up durante el drag. */
  useEffect(() => {
    const el = gl.domElement;

    if (!isSelected) {
      el.style.cursor = '';
      snapStateRef.current = null;
      if (snapGuideRef) snapGuideRef.current = null;
      return;
    }

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      const xz = hitFloor(e.clientX, e.clientY);
      if (!xz || !groupRef.current) return;
      const rawX = d.startObjXZ[0] + (xz[0] - d.startFloorXZ[0]);
      const rawZ = d.startObjXZ[1] + (xz[1] - d.startFloorXZ[1]);
      const wall = computeWallSnap(rawX, rawZ, hw, hd, walls);
      // Alineación desde la posición raw para que cada snap trabaje de forma independiente
      const align = computeAlignmentSnap(rawX, rawZ, hw, hd, item.id, items);
      // Snap de muro tiene prioridad absoluta en su eje; la alineación actúa en el eje libre
      const preX = wall.snap?.axis === 'x' ? wall.snappedX : align.snappedX;
      const preZ = wall.snap?.axis === 'z' ? wall.snappedZ : align.snappedZ;
      // Clamp final: la alineación no puede incrustrar el mueble en un muro
      const [finalX, finalZ] = clampToWalls(preX, preZ, hw, hd, walls);
      groupRef.current.position.x = finalX;
      groupRef.current.position.z = finalZ;
      snapStateRef.current = wall.snap;
      if (snapGuideRef) snapGuideRef.current = { alignX: align.alignX, alignZ: align.alignZ };
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      snapStateRef.current = null;
      if (snapGuideRef) snapGuideRef.current = null;
      if (controls) controls.enabled = true;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
      const group = groupRef.current;
      if (!group) return;
      const movedX = Math.abs(group.position.x - d.startObjXZ[0]);
      const movedZ = Math.abs(group.position.z - d.startObjXZ[1]);
      if (movedX < 0.001 && movedZ < 0.001) return;
      const { doc, updateObject } = useCanvasStore.getState();
      const structObj = doc.objects.find((o) => o.id === item.id);
      if (structObj) {
        // Resolución de colisiones al soltar (solo para objetos del suelo sin elevación).
        let finalX = group.position.x;
        let finalZ = group.position.z;
        if (isFloorCollidable({ kind: item.kind, elevationM: item.floorElevationM })) {
          const itemAABB = buildFloorAABB(item.id, finalX, finalZ, item.size[0], item.size[2], item.rotationY);
          const othersAABB = items
            .filter((o) => o.id !== item.id && isFloorCollidable({ kind: o.kind, elevationM: o.floorElevationM }))
            .map((o) => buildFloorAABB(o.id, o.center[0], o.center[2], o.size[0], o.size[2], o.rotationY));
          [finalX, finalZ] = resolveFloorCollisions(itemAABB, othersAABB);
          group.position.x = finalX;
          group.position.z = finalZ;
        }
        const positionPatch = translatePatch(structObj, [finalX, finalZ], sceneCoords);
        const elevation = computeAutoElevation(finalX, finalZ, hw, hd, item.id, items);
        updateObject(item.id, { ...positionPatch, elevationM: elevation });
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [isSelected, hitFloor, groupRef, controls, gl, item.id, sceneCoords, walls, items, hw, hd, snapStateRef, snapGuideRef]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const ne = e.nativeEvent;
      const xz = hitFloor(ne.clientX, ne.clientY);
      if (!xz) return;
      if (controls) controls.enabled = false;
      gl.domElement.setPointerCapture(ne.pointerId);
      gl.domElement.style.cursor = 'grabbing';
      dragRef.current = {
        active: true,
        pointerId: ne.pointerId,
        startFloorXZ: xz,
        startObjXZ: [item.center[0], item.center[2]],
      };
    },
    [hitFloor, controls, gl, item.center],
  );

  const onPointerEnter = useCallback(() => {
    gl.domElement.style.cursor = 'grab';
  }, [gl]);

  const onPointerLeave = useCallback(() => {
    if (!dragRef.current?.active) gl.domElement.style.cursor = '';
  }, [gl]);

  return { onPointerDown, onPointerEnter, onPointerLeave };
}

// ── Indicador + menú de selección ───────────────────────────────────────────

/**
 * Caja wireframe + indicador de snap + menú flotante sobre el objeto seleccionado.
 * Se monta DENTRO del grupo raíz del mueble (posición relativa al objeto).
 */
function SelectionOverlay({
  item,
  mode,
  onSetMode,
  onDeselect,
  onSwap,
  snapStateRef,
}: {
  item: FurnitureItem;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  onDeselect: () => void;
  onSwap?: () => void;
  snapStateRef: React.RefObject<SnapState>;
}) {
  const removeObject = useCanvasStore((s) => s.removeObject);
  const duplicateObjects = useCanvasStore((s) => s.duplicateObjects);
  const snapMeshRef = useRef<Mesh | null>(null);

  const [w, h, d] = item.size;

  // Actualiza el indicador de snap cada frame sin disparar re-renders de React.
  useFrame(() => {
    const mesh = snapMeshRef.current;
    if (!mesh) return;
    const snap = snapStateRef.current;
    if (!snap) { mesh.visible = false; return; }
    mesh.visible = true;
    if (snap.axis === 'z') {
      mesh.position.set(0, h / 2, snap.side * (d / 2));
      mesh.scale.set(w + 0.04, h + 0.1, 0.02);
    } else {
      mesh.position.set(snap.side * (w / 2), h / 2, 0);
      mesh.scale.set(0.02, h + 0.1, d + 0.04);
    }
  });

  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <meshBasicMaterial color="#2196f3" wireframe />
      </mesh>

      {/* Plano de snap: 1×1×1 escalado por useFrame cuando hay snap activo */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <mesh ref={snapMeshRef as any} visible={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} />
      </mesh>

      {/* pointerEvents:none en el wrapper evita bloquear OrbitControls */}
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
          onDuplicate={() => duplicateObjects([item.id])}
          onDelete={() => { removeObject(item.id); onDeselect(); }}
          onClose={onDeselect}
          onSwap={onSwap}
        />
      </Html>
    </>
  );
}

// ── Modelo GLTF ─────────────────────────────────────────────────────────────

/**
 * Modelo glTF de un mueble, normalizado a las medidas reales del objeto.
 * Drag-to-move activo cuando el item está seleccionado.
 */
function FurnitureModel({
  item,
  url,
  sel,
  sceneCoords,
}: {
  item: FurnitureItem;
  url: string;
  sel: SelectionProps;
  sceneCoords: SceneCoords;
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
  const groupRef = useRef<Group>(null);
  const snapStateRef = useRef<SnapState>(null);
  const { onPointerDown, onPointerEnter, onPointerLeave } = useDragOnFloor({
    groupRef, item, isSelected, sceneCoords,
    walls: sel.walls, items: sel.items, snapStateRef, snapGuideRef: sel.snapGuideRef,
  });

  return (
    <group
      ref={groupRef}
      name={item.id}
      userData={{ isFurniture: true }}
      position={[item.center[0], item.floorElevationM, item.center[2]]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); sel.onSelect(item.id); }}
      onPointerDown={isSelected ? onPointerDown : undefined}
      onPointerEnter={isSelected ? onPointerEnter : undefined}
      onPointerLeave={isSelected ? onPointerLeave : undefined}
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
          onSwap={sel.onSwap ? () => sel.onSwap!(item.id) : undefined}
          snapStateRef={snapStateRef}
        />
      ) : null}
    </group>
  );
}

// ── Placeholder ──────────────────────────────────────────────────────────────

/** Caja a escala real, coloreada por categoría, para kinds sin modelo glTF. */
function FurniturePlaceholder({
  item,
  sel,
  sceneCoords,
}: {
  item: FurnitureItem;
  sel: SelectionProps;
  sceneCoords: SceneCoords;
}) {
  const isSelected = sel.selectedId === item.id;
  const groupRef = useRef<Group>(null);
  const snapStateRef = useRef<SnapState>(null);
  const { onPointerDown, onPointerEnter, onPointerLeave } = useDragOnFloor({
    groupRef, item, isSelected, sceneCoords,
    walls: sel.walls, items: sel.items, snapStateRef, snapGuideRef: sel.snapGuideRef,
  });

  return (
    <group
      ref={groupRef}
      name={item.id}
      userData={{ isFurniture: true }}
      position={[item.center[0], item.floorElevationM, item.center[2]]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); sel.onSelect(item.id); }}
      onPointerDown={isSelected ? onPointerDown : undefined}
      onPointerEnter={isSelected ? onPointerEnter : undefined}
      onPointerLeave={isSelected ? onPointerLeave : undefined}
    >
      <mesh position={[0, item.size[1] / 2, 0]}>
        <boxGeometry args={item.size} />
        <meshStandardMaterial
          color={placeholderColor(item.kind)}
          transparent
          opacity={0.85}
        />
      </mesh>
      {isSelected ? (
        <SelectionOverlay
          item={item}
          mode={sel.mode}
          onSetMode={sel.onSetMode}
          onDeselect={sel.onDeselect}
          onSwap={sel.onSwap ? () => sel.onSwap!(item.id) : undefined}
          snapStateRef={snapStateRef}
        />
      ) : null}
    </group>
  );
}

// ── Capa principal ───────────────────────────────────────────────────────────

/**
 * Renderiza todos los muebles: modelo glTF si existe, si no placeholder.
 * memo() evita re-renders que sobreescribirían la posición durante un drag.
 */
export const FurnitureLayer = memo(function FurnitureLayer({
  items,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
  sceneCoords,
  onSwap,
  walls,
  snapGuideRef,
}: {
  items: FurnitureItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  sceneCoords: SceneCoords;
  onSwap?: (id: string) => void;
  walls: WallBox[];
  snapGuideRef?: React.MutableRefObject<SnapGuideData>;
}) {
  const sel: SelectionProps = { selectedId, onSelect, onDeselect, mode, onSetMode, onSwap, walls, items, snapGuideRef };

  return (
    <group>
      {items.map((item) => {
        const url = furnitureModelUrl(item.kind);
        if (!url) {
          return <FurniturePlaceholder key={item.id} item={item} sel={sel} sceneCoords={sceneCoords} />;
        }
        return (
          <Suspense key={item.id} fallback={<FurniturePlaceholder item={item} sel={sel} sceneCoords={sceneCoords} />}>
            <FurnitureModel item={item} url={url} sel={sel} sceneCoords={sceneCoords} />
          </Suspense>
        );
      })}
    </group>
  );
});
