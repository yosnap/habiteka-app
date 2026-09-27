'use client';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Edges, Html, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Furniture } from '@/lib/editor-document/schema';
import { furnitureAsset, ORIGINAL_ASSET_COLOR } from '@/lib/editor-document/furniture-assets';
import { furnitureSpatial, objectCenter } from '@/lib/editor-document/spatial-properties';
import { prepareFurnitureModel } from '@/canvas/editor-v2/scene/furniture-model-transform';
import type { SceneBox } from '@/canvas/editor-v2/scene/types';
import { BoxMesh } from './scene-meshes';

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function LoadedModel({ item, selected, onSelect }: { item: Furniture; selected: boolean; onSelect: (id: string) => void }) {
  const asset = furnitureAsset(item)!, { scene } = useGLTF(asset.url, false, true);
  const spatial = furnitureSpatial(item), center = objectCenter(item);
  const anisotropy = useThree((state) => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const prepared = useMemo(() => prepareFurnitureModel(scene, asset.frontRotation,
    spatial.color === ORIGINAL_ASSET_COLOR ? undefined : spatial.color, anisotropy, asset.tintMaterialNames),
    [scene, asset.frontRotation, spatial.color, anisotropy, asset.tintMaterialNames]);
  useEffect(() => () => prepared.dispose(), [prepared]);
  return <group position={[center.x / 1000, spatial.elevationMm / 1000, center.y / 1000]}
    rotation={[0, -item.rotation * Math.PI / 180, 0]} onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}
    userData={{ sourceEntityId: item.id }}>
    <group scale={[item.widthMm / 1000, spatial.heightMm / 1000, item.depthMm / 1000]} dispose={null}>
      <primitive object={prepared.object} />
    </group>
    {selected && <mesh position={[0, spatial.heightMm / 2000, 0]}>
      <boxGeometry args={[item.widthMm / 1000, spatial.heightMm / 1000, item.depthMm / 1000]} />
      <meshBasicMaterial visible={false} />
      <Edges color="#087f75" />
    </mesh>}
  </group>;
}

export function FurnitureModel({ item, boxes, selected, onSelect }: {
  item: Furniture; boxes: SceneBox[]; selected: boolean; onSelect: (id: string) => void;
}) {
  const asset = furnitureAsset(item)!, spatial = furnitureSpatial(item), center = objectCenter(item);
  const fallback = (failed: boolean) => <group>
    {boxes.map((box) => <BoxMesh key={box.id} box={box} selected={selected} onSelect={onSelect} />)}
    <Html center position={[center.x / 1000, (spatial.elevationMm + spatial.heightMm) / 1000 + .1, center.y / 1000]}>
      <span role={failed ? 'alert' : 'status'} style={{ background: '#fff', color: '#36443d', padding: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
        {failed ? 'Modelo no disponible · volumen simplificado' : 'Cargando modelo 3D…'}
      </span>
    </Html>
  </group>;
  return <ModelBoundary key={asset.url} fallback={fallback(true)}>
    <Suspense fallback={fallback(false)}><LoadedModel item={item} selected={selected} onSelect={onSelect} /></Suspense>
  </ModelBoundary>;
}
