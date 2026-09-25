'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEditorStore } from '@/canvas/editor-v2/store';
import type { DraftScope } from '@/canvas/editor-v2/draft-contract';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { activateEditorDocument } from '@/server/editor/save-document';
import { EditorShell } from '../editor-shell';
import { DurableEditor } from './durable-editor';
import type { AutoGenerateRequest } from '../auto-generate-request';
import type { PlanReference } from '@/lib/editor-document/plan-reference';

export function ProjectEditor({ scope, projectName, initial, writable, migration, autoGenerate, reference }: {
  scope: DraftScope; projectName: string; initial: EditorDocument; writable: boolean;
  migration: { fingerprint: string; complete: boolean; issues: string[] } | null;
  autoGenerate?: AutoGenerateRequest | null;
  reference?: PlanReference | null;
}) {
  const router = useRouter();
  const [store] = useState(() => createEditorStore(initial, { readOnly: true }));
  const [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!migration && writable)
    return (
      <DurableEditor
        scope={scope}
        projectName={projectName}
        initial={initial}
        autoGenerate={autoGenerate ?? null}
        reference={reference}
      />
    );
  return <div>
    <section className="border-b bg-amber-50 p-4 text-sm text-amber-950">
      <h1 className="font-semibold">{migration ? 'Revisar antes de activar el editor nuevo' : 'Documento en modo solo lectura'}</h1>
      {migration && <>
        <p>El original quedará conservado como histórico. Tras activar, este plano se editará únicamente en el editor nuevo.</p>
        {migration.issues.length > 0 && <ul className="my-2 list-disc pl-5">{migration.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
        {!migration.complete && <p>No se puede activar todavía: la conversión necesita correcciones para evitar pérdida de contenido.</p>}
        <label className="my-3 flex gap-2"><input type="checkbox" checked={confirmed}
          disabled={!migration.complete || pending} onChange={(e) => setConfirmed(e.target.checked)} />
          He revisado la conversión y quiero activar el editor nuevo para este plano.</label>
        <button className="rounded border px-4 py-2 disabled:opacity-40" disabled={!confirmed || !migration.complete || pending}
          onClick={async () => {
            setPending(true); setError(null);
            try {
              await activateEditorDocument(scope, { document: initial, expectedLegacyFingerprint: migration.fingerprint, confirmed: true });
              router.refresh();
            } catch { setError('No se pudo activar. El original sigue conservado; vuelve a revisar su estado.'); }
            finally { setPending(false); }
          }}>{pending ? 'Activando…' : 'Activar editor nuevo'}</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>
    <EditorShell store={store} projectName={projectName} saveStatus="Solo lectura · sin cambios" reference={reference} />
  </div>;
}
