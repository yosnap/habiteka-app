'use client';

/**
 * Capa de elementos de techo (ceiling_light, pendant_lamp) en la escena 3D (F2).
 *
 * Los ítems de techo cuelgan del techo hacia abajo: su posición Y ya viene calculada
 * por `docToScene` → `objectCenterY()`. A diferencia de los muebles de suelo, los
 * de techo no son arrastrables (están fijos en el techo).
 *
 * Geometrías de placeholder:
 *   - ceiling_light → disco plano + emisión blanca (plafón LED enrasado).
 *   - pendant_lamp  → esfera colgante + cable desde el techo (lámpara colgante).
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { FurnitureItem } from '@/canvas/3d/doc-to-scene';
import type { SceneCoords } from '@/canvas/3d/scene-to-doc';
import { translatePatch } from '@/canvas/3d/scene-to-doc';
import { useCanvasStore } from '@/canvas/canvas-store';
import { RadialContextMenu } from './radial-context-menu';
import type { SelectionMode } from './use-3d-selection';

// ── Plafón enrasado ───────────────────────────────────────────────────────────

function CeilingLightMesh({ item }: { item: FurnitureItem }) {
  const [w, h, d] = item.size;
  const radius = Math.max(w, d) / 2;
  return (
    <group>
      {/* Cuerpo plano del plafón */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, h, 32]} />
        <meshStandardMaterial color="#f5f0e0" emissive="#fff8d6" emissiveIntensity={0.6} />
      </mesh>
      {/* Aro exterior */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[radius + 0.01, 0.01, 8, 32]} />
        <meshStandardMaterial color="#d0c8b0" />
      </mesh>
    </group>
  );
}

// ── Lámpara colgante ──────────────────────────────────────────────────────────

/**
 * @param ceilingLocalY  Distancia en espacio local del grupo desde el centro del objeto hasta el techo.
 *                       = ceilingHeightM - item.center[1]  (ya calculado por el caller).
 */
function PendantLampMesh({ item, ceilingLocalY }: { item: FurnitureItem; ceilingLocalY: number }) {
  const [w, , d] = item.size;
  const radius = Math.max(w, d) / 2;
  // El cable va desde la parte superior de la semiesfera (Y = +radius) hasta el techo (Y = ceilingLocalY).
  const cableLen = Math.max(0, ceilingLocalY - radius);
  const cableCenterY = radius + cableLen / 2;
  return (
    <group>
      {/* Cable desde la cúpula hasta el techo */}
      <mesh position={[0, cableCenterY, 0]}>
        <cylinderGeometry args={[0.005, 0.005, cableLen, 6]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {/* Pantalla semiesférica (boca hacia abajo) */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c8a96e" side={2} emissive="#ffd080" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ── Overlay de selección ──────────────────────────────────────────────────────

function CeilingSelectionOverlay({
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
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w + 0.04, h + 0.04, d + 0.04]} />
        <meshBasicMaterial color="#2196f3" wireframe />
      </mesh>
      <Html
        center
        position={[0, -(h / 2 + 0.3), 0]}
        zIndexRange={[100, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <RadialContextMenu
          mode={mode}
          onMove={() => onSetMode('translate')}
          onRotate={() => onSetMode('rotate')}
          onDuplicate={() => duplicateObjects([item.id])}
          onDelete={() => { removeObject(item.id); onDeselect(); }}
          onClose={onDeselect}
        />
      </Html>
    </>
  );
}

// ── Item individual ───────────────────────────────────────────────────────────

/**
 * Drag de un elemento de techo por el plano del techo (Y fijo, mover solo XZ).
 * Versión simplificada de `useDragOnFloor`: sin snap a muros ni colisiones (las luces
 * de techo no colisionan con muebles de suelo). El rayo se corta contra el plano
 * horizontal a la altura del centro del item (y = item.center[1]).
 */
function useDragOnCeiling(
  item: FurnitureItem,
  isSelected: boolean,
  sceneCoords: SceneCoords,
  groupRef: React.RefObject<{ position: { x: number; z: number } }>,
) {
  const { camera, gl } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startPlaneXZ: [number, number];
    startObjXZ: [number, number];
  } | null>(null);

  /** Rayo desde la cámara contra el plano horizontal a la altura del techo del item. */
  const hitCeiling = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      // Plano y = item.center[1] → Plane(normal=(0,1,0), constant = -y).
      const plane = new Plane(new Vector3(0, 1, 0), -item.center[1]);
      const target = new Vector3();
      return raycaster.ray.intersectPlane(plane, target) ? [target.x, target.z] : null;
    },
    [camera, gl, item.center],
  );

  useEffect(() => {
    const el = gl.domElement;
    if (!isSelected) {
      el.style.cursor = '';
      return;
    }

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      const xz = hitCeiling(e.clientX, e.clientY);
      if (!xz || !groupRef.current) return;
      groupRef.current.position.x = d.startObjXZ[0] + (xz[0] - d.startPlaneXZ[0]);
      groupRef.current.position.z = d.startObjXZ[1] + (xz[1] - d.startPlaneXZ[1]);
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
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
        const patch = translatePatch(structObj, [group.position.x, group.position.z], sceneCoords);
        updateObject(item.id, patch);
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [isSelected, hitCeiling, groupRef, controls, gl, item.id, sceneCoords]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const ne = e.nativeEvent;
      const xz = hitCeiling(ne.clientX, ne.clientY);
      if (!xz) return;
      if (controls) controls.enabled = false;
      gl.domElement.setPointerCapture(ne.pointerId);
      gl.domElement.style.cursor = 'grabbing';
      dragRef.current = {
        active: true,
        pointerId: ne.pointerId,
        startPlaneXZ: xz,
        startObjXZ: [item.center[0], item.center[2]],
      };
    },
    [hitCeiling, controls, gl, item.center],
  );

  const onPointerEnter = useCallback(() => {
    gl.domElement.style.cursor = 'grab';
  }, [gl]);
  const onPointerLeave = useCallback(() => {
    if (!dragRef.current?.active) gl.domElement.style.cursor = '';
  }, [gl]);

  return { onPointerDown, onPointerEnter, onPointerLeave };
}

function CeilingItem({
  item,
  ceilingHeightM,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
  sceneCoords,
}: {
  item: FurnitureItem;
  ceilingHeightM: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  sceneCoords: SceneCoords;
}) {
  const isSelected = selectedId === item.id;
  // Posición real: item.center ya tiene el Y correcto calculado por objectCenterY
  const [cx, cy, cz] = item.center;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupRef = useRef<any>(null);
  const { onPointerDown, onPointerEnter, onPointerLeave } = useDragOnCeiling(
    item,
    isSelected,
    sceneCoords,
    groupRef,
  );

  return (
    <group
      ref={groupRef}
      name={item.id}
      position={[cx, cy, cz]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {item.kind === 'pendant_lamp' ? (
        <PendantLampMesh item={item} ceilingLocalY={ceilingHeightM - cy} />
      ) : (
        <CeilingLightMesh item={item} />
      )}
      {isSelected && (
        <CeilingSelectionOverlay
          item={item}
          mode={mode}
          onSetMode={onSetMode}
          onDeselect={onDeselect}
        />
      )}
    </group>
  );
}

// ── Capa principal ────────────────────────────────────────────────────────────

export const CeilingLayer = memo(function CeilingLayer({
  items,
  ceilingHeightM,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
  sceneCoords,
}: {
  items: FurnitureItem[];
  ceilingHeightM: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
  sceneCoords: SceneCoords;
}) {
  if (items.length === 0) return null;
  return (
    <group>
      {items.map((item) => (
        <CeilingItem
          key={item.id}
          item={item}
          ceilingHeightM={ceilingHeightM}
          selectedId={selectedId}
          onSelect={onSelect}
          onDeselect={onDeselect}
          mode={mode}
          onSetMode={onSetMode}
          sceneCoords={sceneCoords}
        />
      ))}
    </group>
  );
});
