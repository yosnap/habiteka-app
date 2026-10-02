import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { furnitureAsset } from './furniture-assets';

export type ApprovedLightingPreset = import('@/lib/lighting-preset').LightingPreset;

export interface ApprovedAsset {
  levelId: string;
  itemId: string;
  catalogId: string | null;
  modelPath: string | null;
  sha256: string | null;
}

export interface ApprovedDesign {
  id: string;
  revision: number;
  fingerprint: string;
  approvedAt: string;
  approvedById: string;
  lightingPreset: ApprovedLightingPreset;
  document: EditorDocument;
  assets: ApprovedAsset[];
}

export type ApprovedDesignSummary = Pick<ApprovedDesign, 'id' | 'revision' | 'approvedAt' | 'lightingPreset'>;

/** La identidad visual aprobada incluye el modelo concreto de cada mueble y su planta. */
export function approvedAssets(document: EditorDocument): ApprovedAsset[] {
  return buildingDocuments(document).flatMap((level) => level.document.furniture.map((item) => {
    const asset = furnitureAsset(item);
    return {
      levelId: level.id,
      itemId: item.id,
      catalogId: item.catalogId ?? null,
      modelPath: asset?.url ?? null,
      sha256: asset?.sha256 ?? null,
    };
  })).sort((a, b) => `${a.levelId}:${a.itemId}`.localeCompare(`${b.levelId}:${b.itemId}`));
}

export function approvedAssetsMatch(document: EditorDocument, assets: ApprovedAsset[]): boolean {
  return JSON.stringify(canonical(approvedAssets(document))) === JSON.stringify(canonical(assets));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

/** Compara el diseño ignorando revisión, fondo auxiliar del plano y orden de claves de JSONB. */
export function sameDesignContent(first: EditorDocument, second: EditorDocument): boolean {
  return JSON.stringify(canonical({ ...first, revision: 0, renderBackdrop: undefined })) ===
    JSON.stringify(canonical({ ...second, revision: 0, renderBackdrop: undefined }));
}
