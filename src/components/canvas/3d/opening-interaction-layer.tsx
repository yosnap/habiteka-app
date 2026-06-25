'use client';

/**
 * Capa de interacción para puertas y ventanas en 3D: cajas invisibles encima de
 * cada hueco que permiten seleccionar (→ panel de propiedades para redimensionar)
 * y arrastrar para reposicionar la apertura DENTRO del muro al que pertenece.
 *
 * Constraints durante el drag:
 *  - El movimiento se proyecta sobre el eje del muro más cercano (slide along wall).
 *  - Si no se encuentra muro cercano (<0.6 m perpendicularmente), se permite
 *    movimiento libre para que el usuario lo coloque en otro muro.
 *  - Se muestra una guía de alineación cyan a lo largo del muro activo.
 *
 * La visual real (marcos + cristal) sigue en OpeningFramesLayer y GlassLayer.
 */
import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Group, Raycaster, Plane, Vector2, Vector3 } from 'three';
import type { Scene3D, WallBox } from '@/canvas/3d/doc-to-scene';
import { rotation2DToY } from '@/canvas/3d/doc-to-scene';
import type { CanvasDoc, StructObj } from '@/canvas/types';
import { useCanvasStore } from '@/canvas/canvas-store';
import { translatePatch } from '@/canvas/3d/scene-to-doc';
import type { SnapGuideData } from './furniture-layer';

// ── Utilidades de proyección sobre muro ────────────────────────────────────

/**
 * Busca el muro más cercano al punto (cx, cz) en el espacio del mundo.
 * Solo considera muros cuya proyección paralela cae dentro del tramo del muro
 * (con un margen de 30 cm para huecos cerca de los extremos).
 */
function findNearestWall(cx: number, cz: number, walls: WallBox[]): WallBox | null {
  let best: WallBox | null = null;
  let minPerp = Infinity;

  for (const wall of walls) {
    const dx = Math.cos(wall.rotationY);
    const dz = -Math.sin(wall.rotationY);
    const vmx = cx - wall.center[0];
    const vmz = cz - wall.center[2];
    // Componente paralela al muro
    const parallel = vmx * dx + vmz * dz;
    // Componente perpendicular al muro
    const perp = Math.abs(-dz * vmx + dx * vmz);
    const halfLen = wall.size[0] / 2;
    if (Math.abs(parallel) <= halfLen + 0.3 && perp < minPerp) {
      minPerp = perp;
      best = wall;
    }
  }
  // Solo devuelve el muro si el hueco está razonablemente cerca de él
  return minPerp < 0.6 ? best : null;
}

/**
 * Proyecta el punto (mx, mz) sobre el eje del muro, devolviendo la posición
 * restringida al tramo del muro. El hueco puede sobresalir hasta halfOpeningW
 * en los extremos (no se recorta exactamente al borde del muro).
 */
function projectOntoWall(
  mx: number,
  mz: number,
  wall: WallBox,
  halfOpeningW: number,
): [number, number] {
  const dx = Math.cos(wall.rotationY);
  const dz = -Math.sin(wall.rotationY);
  const vmx = mx - wall.center[0];
  const vmz = mz - wall.center[2];
  const proj = vmx * dx + vmz * dz;
  const halfLen = wall.size[0] / 2;
  const clamped = Math.max(-halfLen + halfOpeningW, Math.min(halfLen - halfOpeningW, proj));
  return [wall.center[0] + clamped * dx, wall.center[2] + clamped * dz];
}

/**
 * Devuelve el valor de guía de alineación que corresponde al eje del muro:
 *  - Muro horizontal (a lo largo de X): guía horizontal → alignZ
 *  - Muro vertical (a lo largo de Z): guía vertical → alignX
 */
function wallGuide(wall: WallBox): SnapGuideData {
  const cosAbs = Math.abs(Math.cos(wall.rotationY));
  if (cosAbs > 0.7) return { alignZ: wall.center[2] };
  return { alignX: wall.center[0] };
}

// ── Componente por apertura ─────────────────────────────────────────────────

function OpeningBox({
  op,
  scene,
  isSelected,
  onSelect,
  snapGuideRef,
}: {
  op: StructObj;
  scene: Scene3D;
  isSelected: boolean;
  onSelect?: (id: string) => void;
  snapGuideRef?: React.MutableRefObject<SnapGuideData>;
}) {
  const { camera, gl } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;

  const cx = (op.x + op.width / 2 - scene.planCenterPx[0]) / scene.pxPerMeter;
  const cz = (op.y + op.height / 2 - scene.planCenterPx[1]) / scene.pxPerMeter;
  const wm = Math.max(op.width / scene.pxPerMeter, 0.3);
  const dm = Math.max(op.height / scene.pxPerMeter, 0.15);
  const hm = scene.ceilingHeightM;
  const rotY = rotation2DToY(op.rotation ?? 0);

  const groupRef = useRef<Group | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startFloorXZ: [number, number];
    startObjXZ: [number, number];
    wall: WallBox | null;
  } | null>(null);

  const hitFloor = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
      const target = new Vector3();
      return raycaster.ray.intersectPlane(floorPlane, target) ? [target.x, target.z] : null;
    },
    [camera, gl],
  );

  // Listeners de drag: siempre activos (dragRef.current gatea el movimiento)
  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      const xz = hitFloor(e.clientX, e.clientY);
      if (!xz || !groupRef.current) return;

      let finalX: number;
      let finalZ: number;

      if (d.wall) {
        [finalX, finalZ] = projectOntoWall(xz[0], xz[1], d.wall, wm / 2);
        if (snapGuideRef) snapGuideRef.current = wallGuide(d.wall);
      } else {
        finalX = d.startObjXZ[0] + (xz[0] - d.startFloorXZ[0]);
        finalZ = d.startObjXZ[1] + (xz[1] - d.startFloorXZ[1]);
        const nearWall = findNearestWall(finalX, finalZ, scene.walls);
        if (snapGuideRef) snapGuideRef.current = nearWall ? wallGuide(nearWall) : null;
      }

      groupRef.current.position.x = finalX;
      groupRef.current.position.z = finalZ;
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (snapGuideRef) snapGuideRef.current = null;
      if (controls) controls.enabled = true;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = isSelected ? 'grab' : '';
      const group = groupRef.current;
      if (!group) return;
      if (
        Math.abs(group.position.x - d.startObjXZ[0]) < 0.001 &&
        Math.abs(group.position.z - d.startObjXZ[1]) < 0.001
      ) return;
      const { doc, updateObject } = useCanvasStore.getState();
      const structObj = doc.objects.find((o) => o.id === op.id);
      if (structObj) {
        updateObject(op.id, translatePatch(structObj, [group.position.x, group.position.z], scene));
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [isSelected, hitFloor, gl, controls, op.id, scene, wm, snapGuideRef]);

  // onPointerDown: selecciona Y empieza el drag en el mismo gesto
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onSelect?.(op.id); // selecciona si aún no está seleccionado
      const xz = hitFloor(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!xz) return;
      if (controls) controls.enabled = false;
      gl.domElement.setPointerCapture(e.nativeEvent.pointerId);
      gl.domElement.style.cursor = 'grabbing';
      const group = groupRef.current;
      const startXZ: [number, number] = group
        ? [group.position.x, group.position.z]
        : [cx, cz];
      const wall = findNearestWall(startXZ[0], startXZ[1], scene.walls);
      if (wall && snapGuideRef) snapGuideRef.current = wallGuide(wall);
      dragRef.current = {
        active: true,
        pointerId: e.nativeEvent.pointerId,
        startFloorXZ: xz,
        startObjXZ: startXZ,
        wall,
      };
    },
    [onSelect, op.id, hitFloor, controls, gl, cx, cz, scene.walls, snapGuideRef],
  );

  return (
    <group
      ref={groupRef}
      name={op.id}
      position={[cx, hm / 2, cz]}
      rotation={[0, rotY, 0]}
      // onClick detiene la propagación para que el muro detrás no reciba el clic
      onClick={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerEnter={() => { gl.domElement.style.cursor = 'grab'; }}
      onPointerLeave={() => { if (!dragRef.current?.active) gl.domElement.style.cursor = ''; }}
    >
      {/* Caja de colisión invisible — permite seleccionar y arrastrar */}
      <mesh>
        <boxGeometry args={[wm, hm, dm]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {isSelected && (
        <mesh>
          <boxGeometry args={[wm + 0.02, hm + 0.02, dm + 0.02]} />
          <meshBasicMaterial color="#2196f3" wireframe />
        </mesh>
      )}
    </group>
  );
}

// ── Capa pública ─────────────────────────────────────────────────────────────

export function OpeningInteractionLayer({
  doc,
  scene,
  selectedId,
  onSelect,
  snapGuideRef,
}: {
  doc: CanvasDoc;
  scene: Scene3D;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  snapGuideRef?: React.MutableRefObject<SnapGuideData>;
}) {
  const openings = useMemo(
    () => doc.objects.filter((o) => o.kind === 'window' || o.kind === 'door'),
    [doc.objects],
  );
  return (
    <group>
      {openings.map((op) => (
        <OpeningBox
          key={op.id}
          op={op}
          scene={scene}
          isSelected={selectedId === op.id}
          onSelect={onSelect}
          snapGuideRef={snapGuideRef}
        />
      ))}
    </group>
  );
}
