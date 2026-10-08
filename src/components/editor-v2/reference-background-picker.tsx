'use client';

/**
 * Elige qué imagen se ve de fondo con «Mostrar original»: el plano original o un
 * redibujado de la IA. Se alinea sola con los muros, sin IA ni coste.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModernSelect } from '@/components/ui/modern-select';
import { setEditorBackgroundStudio } from '@/app/(app)/projects/[id]/_actions/studio-actions';
import { callAction } from '@/lib/action-result';
import type { PlanReference } from '@/lib/editor-document/plan-reference';

export function ReferenceBackgroundPicker({ choices }: { choices: NonNullable<PlanReference['choices']> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <>
    <span style={{ width: 200, flex: '0 0 auto' }}><ModernSelect compact aria-label="Imagen de fondo" value={choices.activeKey ?? ''} disabled={pending}
      onChange={(event) => {
        const assetKey = event.target.value;
        if (!assetKey || assetKey === choices.activeKey) return;
        setPending(true); setError(null);
        void callAction(setEditorBackgroundStudio(choices.projectId, assetKey))
          .then(() => router.refresh())
          .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cambiar el fondo.'))
          .finally(() => setPending(false));
      }}>
      {choices.options.map((option) => <option key={option.assetKey} value={option.assetKey}>{option.label}</option>)}
    </ModernSelect></span>
    {error && <span role="alert">{error}</span>}
  </>;
}
