'use client';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { localToWorld, furnitureSpatial } from '@/lib/editor-document/spatial-properties';

/** Tres emisores acotados por tira: luz cálida reutilizable en interiores y exteriores. */
export function OutdoorLighting({ document }: { document: EditorDocument }) {
  return <group>{document.furniture.filter((item) => item.catalogId === 'habiteka:outdoor:tira-led').map((item) => {
    const spatial = furnitureSpatial(item);
    return <group key={item.id}>{[.15, .5, .85].map((ratio) => {
      const point = localToWorld(item, { x: item.widthMm * ratio, y: item.depthMm / 2 });
      return <pointLight key={ratio} position={[point.x / 1000, (spatial.elevationMm + spatial.heightMm + 15) / 1000, point.y / 1000]}
        color="#ffe3ad" intensity={1.5} distance={2.5} decay={2} />;
    })}</group>;
  })}</group>;
}
