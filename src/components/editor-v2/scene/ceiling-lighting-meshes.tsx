'use client';
import { useEffect, useMemo } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { ceilingSurfaces, resolvedLuminaires, luminaireDepthMm, luminaireRadiusMm } from '@/lib/editor-document/ceiling-geometry';
import { ceilingShapes, createLuminaireEmitter, lightBudgetSplit, MAX_LUMINAIRE_LIGHTS, MAX_SHADOW_LIGHTS, shadowLightIds, temperatureColor, type CeilingView } from './ceiling-scene-utils';
import { resolvedStrips } from '@/lib/editor-document/light-strip-geometry';
import { LightStripMeshes } from './light-strip-meshes';

type Surface = ReturnType<typeof ceilingSurfaces>[number];
type ResolvedLight = ReturnType<typeof resolvedLuminaires>[number];

function CeilingMesh({ surface, view, selected, onSelect, voids }: {
  surface: Surface; view: CeilingView; selected: boolean; onSelect?: (id: string) => void; voids: Point[][];
}) {
  const shapes = useMemo(() => ceilingShapes(surface.room.boundary, voids), [surface.room.boundary, voids]);
  if (view === 'hidden') return null;
  const transparent = view === 'transparent';
  return shapes.map((shape, index) => <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[0, surface.heightMm / 1000, 0]}
    castShadow={!transparent} receiveShadow={!transparent}
    raycast={transparent || !onSelect ? () => undefined : undefined}
    userData={{ sourceEntityId: surface.ceiling.id }}
    onClick={onSelect && !transparent ? (event) => { event.stopPropagation(); onSelect(surface.ceiling.id); } : undefined}>
    {surface.ceiling.kind === 'suspended'
      ? <extrudeGeometry args={[shape, { depth: .04, bevelEnabled: false, steps: 1 }]} />
      : <shapeGeometry args={[shape]} />}
    <meshStandardMaterial color={selected ? '#43b6a0' : surface.ceiling.color} side={2} roughness={.85}
      emissive={surface.ceiling.color} emissiveIntensity={.08}
      transparent={transparent} opacity={transparent ? .16 : 1} depthWrite={!transparent} />
  </mesh>);
}

function LuminaireMesh({ resolved, view, selected, emitLight, castShadow, onSelect }: {
  resolved: ResolvedLight; view: CeilingView; selected: boolean; emitLight: boolean; castShadow: boolean; onSelect?: (id: string) => void;
}) {
  const { luminaire, heightMm, ceilingHeightMm, effectiveTemperatureK, effectiveLumens, effectiveEnabled } = resolved;
  // La escena activa de la estancia manda sobre los valores nominales.
  const lightColor = temperatureColor(effectiveTemperatureK);
  const emitter = useMemo(() => createLuminaireEmitter(luminaire, { temperatureK: effectiveTemperatureK, lumens: effectiveLumens }, castShadow),
    [luminaire, effectiveTemperatureK, effectiveLumens, castShadow]);
  useEffect(() => () => emitter.dispose(), [emitter]);
  const pendant = luminaire.kind === 'pendant';
  const bodyHeight = luminaireDepthMm(luminaire.kind, luminaire.mount) / 1000;
  const radius = luminaireRadiusMm(luminaire.kind, luminaire.mount) / 1000;
  const cableHeight = Math.max(0, (ceilingHeightMm - heightMm) / 1000 - bodyHeight);
  // El cuerpo del foco gira con su haz: primero se inclina y luego se orienta al azimut.
  const spot = luminaire.kind === 'spot';
  const tilt = spot ? (luminaire.tiltDeg ?? 0) * Math.PI / 180 : 0;
  const azimuth = spot ? -(luminaire.azimuthDeg ?? 0) * Math.PI / 180 : 0;
  return <group position={[luminaire.x / 1000, heightMm / 1000, luminaire.y / 1000]}
    userData={{ sourceEntityId: luminaire.id }}
    onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(luminaire.id); } : undefined}>
    {view !== 'hidden' && pendant && cableHeight > 0 && <mesh position={[0, bodyHeight + cableHeight / 2, 0]}>
      <cylinderGeometry args={[.004, .004, cableHeight, 6]} /><meshStandardMaterial color="#424242" />
    </mesh>}
    {view !== 'hidden' && <group rotation={[0, azimuth, 0]}><group rotation={[0, 0, tilt]} position={[0, bodyHeight, 0]}>
      <mesh position={[0, -bodyHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[pendant ? radius * .45 : radius, radius, bodyHeight, 24, 1, true]} />
        <meshStandardMaterial color={selected ? '#43b6a0' : luminaire.color} side={2} roughness={.45} metalness={.15} />
      </mesh>
      <mesh position={[0, .002 - bodyHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * .94, 24]} />
        <meshStandardMaterial side={2} color={lightColor} emissive={lightColor}
          emissiveIntensity={effectiveEnabled ? 1 : 0} roughness={.6} />
      </mesh>
    </group></group>}
    {emitLight && effectiveEnabled && <>
      <primitive object={emitter.target} />
      <primitive object={emitter} />
    </>}
  </group>;
}

export function CeilingLightingMeshes({
  document, view, selection = [], onSelect,
  lightBudget = MAX_LUMINAIRE_LIGHTS, priorityRoomId = null, shadowBudget = MAX_SHADOW_LIGHTS, ceilingVoids = [],
}: {
  document: EditorDocument; view: CeilingView; selection?: string[]; onSelect?: (id: string) => void;
  ceilingVoids?: Point[][];
  lightBudget?: number;
  /** Estancia en la que está el usuario: sus luces entran primero en el presupuesto. */
  priorityRoomId?: string | null;
  /** Cuántas de sus luces proyectan sombra (el tope es global, ver `MAX_SHADOW_LIGHTS`). */
  shadowBudget?: number;
}) {
  const surfaces = useMemo(() => ceilingSurfaces(document), [document]);
  const lights = useMemo(() => resolvedLuminaires(document), [document]);
  const strips = useMemo(() => resolvedStrips(document), [document]);
  // Luminarias y tiras comparten un único presupuesto de luces reales de WebGL.
  const budget = useMemo(() => lightBudgetSplit(lights, strips, lightBudget, priorityRoomId), [lights, strips, lightBudget, priorityRoomId]);
  const emitting = new Set(budget.luminaireIds);
  const shadowing = new Set(shadowLightIds(budget.luminaireIds, shadowBudget));
  return <>
    {surfaces.map((surface) => <CeilingMesh key={surface.ceiling.id} surface={surface} view={view} voids={ceilingVoids}
      selected={selection.includes(surface.ceiling.id)} onSelect={onSelect} />)}
    <LightStripMeshes document={document} selection={selection} emittingIds={budget.stripIds} />
    {lights.map((resolved) => <LuminaireMesh key={resolved.luminaire.id} resolved={resolved} view={view}
      selected={selection.includes(resolved.luminaire.id)} emitLight={emitting.has(resolved.luminaire.id)}
      castShadow={shadowing.has(resolved.luminaire.id)} onSelect={onSelect} />)}
  </>;
}
