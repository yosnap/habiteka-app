'use client';
import { hedgeModelPieces } from '@/lib/editor-document/hedge-model-pieces';
import type { Boundary } from '@/lib/editor-document/boundary-types';
import { FurnitureModel } from './furniture-model';
import { furnitureSceneBoxes } from '@/canvas/editor-v2/scene/editor-document-to-scene';

export function HedgeModel({ boundary, selected, onSelect }: { boundary: Boundary; selected: boolean; onSelect: (id: string) => void }) {
  return <group userData={{ sourceEntityId: boundary.id }}>{hedgeModelPieces(boundary).map((item) =>
    <FurnitureModel key={item.id} item={item} boxes={furnitureSceneBoxes(item)} selected={selected} onSelect={() => onSelect(boundary.id)} />)}</group>;
}
