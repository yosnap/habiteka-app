import type { RoofOpening } from '@/lib/editor-document/roof-opening-types';

/** Sombrerete separado del conducto: deja el paso de salida abierto por los cuatro lados. */
export function RoofChimneyCap({ opening, topM }: { opening: RoofOpening; topM: number }) {
  const width = opening.widthMm / 1000, depth = opening.depthMm / 1000;
  const angle = opening.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const x = opening.x / 1000 + width / 2 * c - depth / 2 * s;
  const z = opening.y / 1000 + width / 2 * s + depth / 2 * c;
  return <group position={[x, topM, z]} rotation={[0, -angle, 0]} userData={{ sourceEntityId: opening.id, videoStage: 2, buildKey: 'exterior-roof' }}>
    <mesh position={[0, .24, 0]} castShadow receiveShadow><boxGeometry args={[width + .16, .08, depth + .16]} />
      <meshStandardMaterial color="#43494b" roughness={.35} metalness={.6} /></mesh>
    {[-1, 1].flatMap(a => [-1, 1].map(b => <mesh key={`${a}:${b}`} position={[a * (width / 2 - .03), .1, b * (depth / 2 - .03)]} castShadow>
      <boxGeometry args={[.035, .2, .035]} /><meshStandardMaterial color="#43494b" roughness={.35} metalness={.6} />
    </mesh>))}
  </group>;
}
