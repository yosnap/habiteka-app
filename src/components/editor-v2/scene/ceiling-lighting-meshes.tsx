'use client';
import { useEffect, useMemo } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { ceilingSurfaces, resolvedLuminaires, luminaireDepthMm, luminaireRadiusMm } from '@/lib/editor-document/ceiling-geometry';
import { ceilingShape, createLuminaireEmitter, MAX_LUMINAIRE_LIGHTS, temperatureColor, type CeilingView } from './ceiling-scene-utils';

type Surface = ReturnType<typeof ceilingSurfaces>[number];
type ResolvedLight = ReturnType<typeof resolvedLuminaires>[number];

function CeilingMesh({ surface, view, selected, onSelect }: {
  surface: Surface; view: CeilingView; selected: boolean; onSelect?: (id: string) => void;
}) {
  const shape = useMemo(() => ceilingShape(surface.room.boundary), [surface.room.boundary]);
  if (view === 'hidden') return null;
  const transparent = view === 'transparent';
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, surface.heightMm / 1000, 0]}
    castShadow={!transparent} receiveShadow={!transparent}
    raycast={transparent || !onSelect ? () => undefined : undefined}
    userData={{ sourceEntityId: surface.ceiling.id }}
    onClick={onSelect && !transparent ? (event) => { event.stopPropagation(); onSelect(surface.ceiling.id); } : undefined}>
    {surface.ceiling.kind === 'suspended'
      ? <extrudeGeometry args={[shape, { depth: .04, bevelEnabled: false, steps: 1 }]} />
      : <shapeGeometry args={[shape]} />}
    <meshStandardMaterial color={selected ? '#43b6a0' : surface.ceiling.color} side={2} roughness={.85}
      transparent={transparent} opacity={transparent ? .16 : 1} depthWrite={!transparent} />
  </mesh>;
}

function LuminaireMesh({ resolved, selected, emitLight, onSelect }: {
  resolved: ResolvedLight; selected: boolean; emitLight: boolean; onSelect?: (id: string) => void;
}) {
  const { luminaire, heightMm, ceilingHeightMm } = resolved;
  const lightColor = temperatureColor(luminaire.temperatureK);
  const emitter = useMemo(() => createLuminaireEmitter(luminaire), [luminaire]);
  useEffect(() => () => emitter.dispose(), [emitter]);
  const pendant = luminaire.kind === 'pendant';
  const bodyHeight = luminaireDepthMm(luminaire.kind) / 1000;
  const radius = luminaireRadiusMm(luminaire.kind) / 1000;
  const cableHeight = Math.max(0, (ceilingHeightMm - heightMm) / 1000 - bodyHeight);
  return <group position={[luminaire.x / 1000, heightMm / 1000, luminaire.y / 1000]}
    userData={{ sourceEntityId: luminaire.id }}
    onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(luminaire.id); } : undefined}>
    {pendant && cableHeight > 0 && <mesh position={[0, bodyHeight + cableHeight / 2, 0]}>
      <cylinderGeometry args={[.004, .004, cableHeight, 6]} /><meshStandardMaterial color="#424242" />
    </mesh>}
    <mesh position={[0, bodyHeight / 2, 0]} castShadow>
      <cylinderGeometry args={[pendant ? radius * .45 : radius, radius, bodyHeight, 24, 1, true]} />
      <meshStandardMaterial color={selected ? '#43b6a0' : luminaire.color} side={2} roughness={.45} metalness={.15} />
    </mesh>
    <mesh position={[0, .002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius * .94, 24]} />
      <meshStandardMaterial side={2} color={lightColor} emissive={lightColor}
        emissiveIntensity={luminaire.enabled ? 1 : 0} roughness={.6} />
    </mesh>
    {emitLight && luminaire.enabled && <>
      <primitive object={emitter.target} />
      <primitive object={emitter} />
    </>}
  </group>;
}

export function CeilingLightingMeshes({ document, view, selection = [], onSelect, lightBudget = MAX_LUMINAIRE_LIGHTS }: {
  document: EditorDocument; view: CeilingView; selection?: string[]; onSelect?: (id: string) => void; lightBudget?: number;
}) {
  const surfaces = useMemo(() => ceilingSurfaces(document), [document]);
  const lights = useMemo(() => resolvedLuminaires(document), [document]);
  const emitting = new Set(lights.filter(({ luminaire }) => luminaire.enabled).slice(0, lightBudget).map(({ luminaire }) => luminaire.id));
  return <>
    {surfaces.map((surface) => <CeilingMesh key={surface.ceiling.id} surface={surface} view={view}
      selected={selection.includes(surface.ceiling.id)} onSelect={onSelect} />)}
    {lights.map((resolved) => <LuminaireMesh key={resolved.luminaire.id} resolved={resolved}
      selected={selection.includes(resolved.luminaire.id)} emitLight={emitting.has(resolved.luminaire.id)} onSelect={onSelect} />)}
  </>;
}
