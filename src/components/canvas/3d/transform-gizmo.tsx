'use client';

/**
 * Gizmo de transformación 3D (F2 editor 3D): envuelve <TransformControls> de drei
 * para mover (XZ) o rotar (Y) el mueble seleccionado. Al soltar el gizmo convierte
 * la posición/rotación worldspace de vuelta al doc (px, grados) y llama updateObject
 * — un solo commit por gesto, sin inundar el historial de undo/redo.
 *
 * Restricciones de ejes (C1 del predict):
 *   translate → showY=false + showXY/showYZ=false vía ref (evitar elevación)
 *   rotate    → showX=false + showZ=false (solo giro en planta, eje Y)
 */
import { useRef, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Object3D } from 'three';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { SelectionMode } from './use-3d-selection';
import { translatePatch, rotatePatch, type SceneCoords } from '@/canvas/3d/scene-to-doc';

export function TransformGizmo({
  selectedId,
  mode,
  scene,
}: {
  selectedId: string;
  mode: Exclude<SelectionMode, 'none'>;
  scene: SceneCoords;
}) {
  const threeScene = useThree((s) => s.scene);
  // Localizar el Object3D del mueble por su name (asignado en furniture-layer.tsx).
  // Si aún no existe (Suspense cargando el glTF), no renderizar el gizmo.
  const obj = (threeScene.getObjectByName(selectedId) as Object3D | undefined) ?? null;

  // Ref al TransformControls subyacente de Three.js (drei lo expone como forwardRef).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gizmoRef = useRef<any>(null);

  useEffect(() => {
    const g = gizmoRef.current;
    if (!g || !obj) return;

    // Ocultar handles de plano que involucran Y en modo translate (C1).
    if (mode === 'translate') {
      if ('showXY' in g) g.showXY = false;
      if ('showYZ' in g) g.showYZ = false;
    }

    // Al soltar el gizmo, convertir la transform worldspace al patch del doc.
    // useCanvasStore.getState() lee el estado ACTUAL sin stale closure.
    const onDraggingChanged = (e: { value: boolean }) => {
      if (e.value) return; // todavía arrastrando
      const { doc, updateObject } = useCanvasStore.getState();
      const structObj = doc.objects.find((o) => o.id === selectedId);
      if (!structObj) return;

      if (mode === 'translate') {
        // Solo leer X y Z — Y siempre es 0 en el grupo raíz (C3 del predict).
        updateObject(selectedId, translatePatch(structObj, [obj.position.x, obj.position.z], scene));
      } else {
        updateObject(selectedId, rotatePatch(structObj, obj.rotation.y, scene));
      }
    };

    g.addEventListener('dragging-changed', onDraggingChanged);
    return () => g.removeEventListener('dragging-changed', onDraggingChanged);
  }, [mode, obj, selectedId, scene]);

  if (!obj) return null;

  if (mode === 'translate') {
    return (
      <TransformControls
        ref={gizmoRef}
        object={obj}
        mode="translate"
        showY={false}
      />
    );
  }

  return (
    <TransformControls
      ref={gizmoRef}
      object={obj}
      mode="rotate"
      showX={false}
      showZ={false}
    />
  );
}
