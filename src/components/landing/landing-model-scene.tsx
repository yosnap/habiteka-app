'use client';
/**
 * Escena 3D ligera de la home: un rincón de salón con muebles reales del
 * catálogo (GLB CC0), orbitable con el ratón. Se carga en diferido, deja de
 * dibujar fuera de pantalla y no gira sola con movimiento reducido.
 */
import { Canvas } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense } from 'react';

const MODELS = {
  sofa: '/models/cc0/sofa_02.glb',
  chair: '/models/cc0/modern_arm_chair_01.glb',
  table: '/models/cc0/coffee_table_round_01.glb',
  vase: '/models/cc0/ceramic_vase_02.glb',
  rug: '/models/cc0/alfombra_yute_200x300.glb',
};

function Piece({ url, position, rotation = 0, scale = 1 }: { url: string; position: [number, number, number]; rotation?: number; scale?: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial color="#d9c7ad" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.4, -2]} receiveShadow>
        <boxGeometry args={[7, 2.8, 0.12]} />
        <meshStandardMaterial color="#f1ebe1" roughness={1} />
      </mesh>
      <mesh position={[-3.5, 1.4, 1.5]} receiveShadow>
        <boxGeometry args={[0.12, 2.8, 7]} />
        <meshStandardMaterial color="#ece4d7" roughness={1} />
      </mesh>
      <Piece url={MODELS.rug} position={[0, 0.005, 0]} />
      <Piece url={MODELS.sofa} position={[0, 0, -1.3]} />
      <Piece url={MODELS.chair} position={[1.6, 0, 0.2]} rotation={-Math.PI / 2} />
      <Piece url={MODELS.table} position={[0, 0, 0]} />
      <Piece url={MODELS.vase} position={[0.2, 0.49, 0.1]} />
    </group>
  );
}

export default function LandingModelScene({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <Canvas frameloop={active ? 'always' : 'never'} shadows dpr={[1, 1.75]} camera={{ position: [3.3, 2.3, 3.6], fov: 38 }} gl={{ antialias: true }}>
      <color attach="background" args={['#efe6d8']} />
      <hemisphereLight args={['#fff6e8', '#b8a58c', 0.9]} />
      <directionalLight position={[4, 6, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <Suspense fallback={null}>
        <Room />
        <ContactShadows frames={1} position={[0, 0.01, 0]} opacity={0.45} scale={8} blur={2.4} far={2} />
      </Suspense>
      <OrbitControls
        target={[0, 0.4, -0.3]}
        enablePan={false}
        enableZoom={false}
        autoRotate={!reduced}
        autoRotateSpeed={0.6}
        minPolarAngle={0.5}
        maxPolarAngle={1.35}
        minAzimuthAngle={-0.2}
        maxAzimuthAngle={1.4}
      />
    </Canvas>
  );
}
