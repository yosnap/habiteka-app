'use client';
import { useMemo, useState } from 'react';
import { CurvePath, LineCurve3, TubeGeometry, Vector3 } from 'three';
import { useMountEffect } from '@/lib/use-mount-effect';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { resolvedStrips, type ResolvedStrip } from '@/lib/editor-document/light-strip-geometry';
import { createStripEmitter, temperatureColor } from './ceiling-scene-utils';

/** Radio del tubo emisivo: el foseado se esconde en la gola, el tramo libre se ve. */
const stripRadius = (strip: ResolvedStrip) => (strip.strip.kind === 'cove' ? .012 : .016);

/** Todo lo que cambia la geometría o la luz de una tira: si cambia, se remonta y se libera lo anterior. */
function stripMeshKey(resolved: ResolvedStrip): string {
  return [resolved.strip.id, resolved.strip.kind, resolved.pathMm.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';'),
    resolved.effectiveTemperatureK, Math.round(resolved.effectiveLumens), resolved.direction,
    resolved.normal ? `${resolved.normal.x.toFixed(3)},${resolved.normal.y.toFixed(3)}` : ''].join('|');
}

/** Una sola malla por tira (tubo sobre su recorrido) y, como mucho, una luz real. */
function LightStripMesh({ resolved, selected, emitLight }: {
  resolved: ResolvedStrip; selected: boolean; emitLight: boolean;
}) {
  const { strip, pathMm, elevationMm } = resolved;
  // Recursos de GPU creados UNA vez por montaje y liberados al desmontar: el
  // componente se remonta (clave `stripMeshKey`) cuando cambia algo que les afecta.
  const [geometry] = useState(() => {
    const path = new CurvePath<Vector3>();
    for (let i = 1; i < pathMm.length; i++)
      path.add(new LineCurve3(
        new Vector3(pathMm[i - 1]!.x / 1000, 0, pathMm[i - 1]!.y / 1000),
        new Vector3(pathMm[i]!.x / 1000, 0, pathMm[i]!.y / 1000)));
    return new TubeGeometry(path, Math.max(2, (pathMm.length - 1) * 2), stripRadius(resolved), 6, false);
  });
  // La escena activa de la estancia manda sobre los valores nominales.
  const [emitter] = useState(() => createStripEmitter({
    temperatureK: resolved.effectiveTemperatureK, lumens: resolved.effectiveLumens,
    direction: resolved.direction, normal: resolved.normal,
  }));
  useMountEffect(() => () => { geometry.dispose(); emitter.dispose(); });
  const color = temperatureColor(resolved.effectiveTemperatureK);
  const middle = pathMm[Math.floor(pathMm.length / 2)]!;
  return <group position={[0, elevationMm / 1000, 0]} userData={{ sourceEntityId: strip.id }}>
    <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
      <meshStandardMaterial color={selected ? '#43b6a0' : color} emissive={color}
        emissiveIntensity={resolved.effectiveEnabled ? 1.4 : 0} roughness={.5} />
    </mesh>
    {emitLight && resolved.effectiveEnabled && <group position={[middle.x / 1000, 0, middle.y / 1000]}>
      <primitive object={emitter.target} />
      <primitive object={emitter} />
    </group>}
  </group>;
}

/** Tiras LED del plano; `emittingIds` son las que reciben luz real del presupuesto. */
export function LightStripMeshes({ document, selection = [], emittingIds = [] }: {
  document: EditorDocument; selection?: string[]; emittingIds?: readonly string[];
}) {
  const strips = useMemo(() => resolvedStrips(document), [document]);
  const emitting = new Set(emittingIds);
  return <>{strips.map((resolved) => <LightStripMesh key={stripMeshKey(resolved)}
    resolved={resolved} selected={selection.includes(resolved.strip.id)} emitLight={emitting.has(resolved.strip.id)} />)}</>;
}
