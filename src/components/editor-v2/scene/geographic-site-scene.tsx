'use client';
import { useEffect, useMemo, useState } from 'react';
import { Shape, ShapeGeometry, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { callAction } from '@/lib/action-result';
import { siteToPlan, type GeographicSite } from '@/lib/editor-document/geographic-site';
import { resolveSiteOrthophoto } from '@/server/editor/geographic-site-actions';

/** The stored aerial image is a flat environment reference, not a surveyed 3D terrain. */
export function GeographicSiteScene({ site, projectId, onReady }: {
  site: GeographicSite; projectId: string; onReady: (ready: boolean) => void;
}) {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    let active = true, loaded: Texture | undefined;
    onReady(false);
    void callAction(resolveSiteOrthophoto(projectId, site)).then(url =>
      new TextureLoader().loadAsync(url)).then(value => {
        loaded = value; value.colorSpace = SRGBColorSpace;
        if (active) { setTexture(value); onReady(true); } else value.dispose();
      }).catch(() => { if (active) onReady(false); });
    return () => { active = false; loaded?.dispose(); onReady(false); };
  }, [projectId, site, onReady]);
  const center = siteToPlan({ x: .5, y: .5 }, site);
  const geometry = useMemo(() => {
    const shape = new Shape();
    site.intervention.forEach((point, index) => {
      const p = siteToPlan(point, site);
      if (!index) shape.moveTo(p.x / 1000, -p.y / 1000);
      else shape.lineTo(p.x / 1000, -p.y / 1000);
    });
    shape.closePath();
    const value = new ShapeGeometry(shape); value.rotateX(-Math.PI / 2);
    return value;
  }, [site]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!texture) return null;
  return <>
    <group position={[center.x / 1000, -.035, center.y / 1000]} rotation={[0, site.rotationDeg * Math.PI / 180, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ geographicBackground: true }}>
        <planeGeometry args={[site.groundWidthM / (site.planScale ?? 1), site.groundWidthM / (site.planScale ?? 1)]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
    </group>
    <mesh geometry={geometry} position={[0, -.025, 0]} visible={false} userData={{ videoStage: -1, interventionSurface: true }}>
      <meshStandardMaterial color="#a99470" roughness={1} />
    </mesh>
  </>;
}
