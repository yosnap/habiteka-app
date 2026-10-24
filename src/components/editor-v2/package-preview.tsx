import type { EditorDocument } from '@/lib/editor-document/schema';
import { packageBounds } from '@/lib/editor-document/package-geometry';

/** Miniatura del contenido real, sin imágenes ni referencias privadas del proyecto de origen. */
export function PackagePreview({ document: doc, name }: { document: EditorDocument; name: string }) {
  const bounds = packageBounds(doc), pad = Math.max(bounds.width, bounds.height) * .08;
  return <svg role="img" aria-label={`Distribución de ${name}`} viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`} width="100%" height="140">
    {doc.walls.map(wall => {
      const a = doc.vertices.find(vertex => vertex.id === wall.startVertexId), b = doc.vertices.find(vertex => vertex.id === wall.endVertexId);
      return a && b && <line key={wall.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#415b51" strokeWidth={wall.thicknessMm} />;
    })}
    {[...doc.furniture, ...(doc.boundaries ?? []), ...(doc.kitchenRuns ?? []), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].map(item =>
      <rect key={item.id} x={item.x} y={item.y} width={item.widthMm} height={item.depthMm}
        transform={`rotate(${item.rotation} ${item.x} ${item.y})`} fill={item.color ?? '#b4c7bb'} stroke="#3f6554" strokeWidth={Math.max(bounds.width, bounds.height) / 150} />)}
    {doc.dimensions.map(item => <line key={item.id} x1={item.from.x} y1={item.from.y} x2={item.to.x} y2={item.to.y} stroke="#52685f" strokeWidth={Math.max(bounds.width, bounds.height) / 150} />)}
    {doc.designZones?.map(zone => <polygon key={zone.id} points={zone.polygon.map(p => `${p.x},${p.y}`).join(' ')} fill="#c3d6c7" fillOpacity=".5" />)}
  </svg>;
}
