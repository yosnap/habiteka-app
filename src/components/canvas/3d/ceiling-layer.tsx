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
import { memo } from 'react';
import { Html } from '@react-three/drei';
import type { FurnitureItem } from '@/canvas/3d/doc-to-scene';
import { useCanvasStore } from '@/canvas/canvas-store';
import { ObjectFloatingMenu } from './object-floating-menu';
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
        <ObjectFloatingMenu
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

function CeilingItem({
  item,
  ceilingHeightM,
  selectedId,
  onSelect,
  onDeselect,
  mode,
  onSetMode,
}: {
  item: FurnitureItem;
  ceilingHeightM: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
}) {
  const isSelected = selectedId === item.id;
  // Posición real: item.center ya tiene el Y correcto calculado por objectCenterY
  const [cx, cy, cz] = item.center;

  return (
    <group
      name={item.id}
      position={[cx, cy, cz]}
      rotation={[0, item.rotationY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
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
}: {
  items: FurnitureItem[];
  ceilingHeightM: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  mode: SelectionMode;
  onSetMode: (m: SelectionMode) => void;
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
        />
      ))}
    </group>
  );
});
