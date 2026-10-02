import type { RefObject } from 'react';
import type { Group } from 'three';

/** Figura visual de la visita; no forma parte del documento editable. */
export function FreeWalkAvatar({ groupRef, legRefs, visible }: {
  groupRef: RefObject<Group | null>;
  legRefs: readonly [RefObject<Group | null>, RefObject<Group | null>];
  visible: boolean;
}) {
  return <group ref={groupRef} visible={visible}>
    <mesh position={[0, 1.08, 0]} castShadow>
      <capsuleGeometry args={[.2, .58, 4, 12]} />
      <meshStandardMaterial color="#237b6b" roughness={.85} />
    </mesh>
    <mesh position={[0, 1.65, .01]} castShadow>
      <sphereGeometry args={[.17, 12, 10]} />
      <meshStandardMaterial color="#b68e72" roughness={1} />
    </mesh>
    {[-1, 1].map((side, index) => <group key={side} ref={legRefs[index]} position={[side * .13, .78, 0]}>
      <mesh position={[0, -.32, 0]} castShadow>
        <cylinderGeometry args={[.085, .09, .64, 8]} />
        <meshStandardMaterial color="#344842" roughness={.9} />
      </mesh>
      <mesh position={[0, -.71, .11]} castShadow>
        <boxGeometry args={[.19, .13, .32]} />
        <meshStandardMaterial color="#253d36" roughness={.9} />
      </mesh>
    </group>)}
    {[-1, 1].map((side) => <mesh key={`arm:${side}`} position={[side * .25, 1.12, 0]} castShadow>
      <capsuleGeometry args={[.075, .48, 4, 8]} />
      <meshStandardMaterial color="#237b6b" roughness={.85} />
    </mesh>)}
  </group>;
}
