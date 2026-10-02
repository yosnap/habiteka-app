'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { runAction } from '@/server/errors/run-action';
import { listRenderPresets, mutateRenderPreset } from '@/server/editor/render-preset-repo';

export async function loadRenderPresets() {
  return runAction(async () => listRenderPresets(await requireOrgContext()));
}
export async function saveRenderPreset(input: unknown) {
  return runAction(async () => mutateRenderPreset(await requireOrgContext(), input));
}
export async function deleteRenderPreset(name: string) {
  return runAction(async () => mutateRenderPreset(await requireOrgContext(), name, true));
}
