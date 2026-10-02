import { notFound } from 'next/navigation';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { RevisionPreview } from './revision-preview';

const PAGE_SIZE = 25;

function revisionNumber(value?: string): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function versionHref(projectId: string, options: { zoneId?: string | null; page?: number; revision?: number }) {
  const search = new URLSearchParams({ vista: 'versiones' });
  if (options.zoneId) search.set('zona', options.zoneId);
  if (options.page && options.page > 1) search.set('pagina', String(options.page));
  if (options.revision !== undefined) search.set('revision', String(options.revision));
  return `/projects/${encodeURIComponent(projectId)}/historial?${search}`;
}

export async function ProjectVersionHistory({ ctx, projectId, query }: {
  ctx: OrgContext; projectId: string;
  query: { pagina?: string; revision?: string; zona?: string };
}) {
  const zones = await withOrg(ctx).zones.list(projectId);
  if (query.zona && !zones.some((zone) => zone.id === query.zona)) notFound();
  const zoneId = query.zona ?? null;
  const page = Math.max(1, revisionNumber(query.pagina) ?? 1);
  const selectedRevision = revisionNumber(query.revision);
  const scope = { projectId, zoneId };
  const documents = withEditorDocuments(ctx);
  const [history, approvals] = await Promise.all([
    documents.listRevisions(scope, Math.min((page - 1) * PAGE_SIZE, 100_000), PAGE_SIZE),
    documents.listApprovals(scope),
  ]);
  const pages = Math.max(1, Math.ceil(history.total / PAGE_SIZE));
  if (page > pages) notFound();
  if (selectedRevision !== null && (history.headRevision === null || selectedRevision > history.headRevision)) notFound();
  let preview = null;
  if (selectedRevision !== null) {
    try { preview = await documents.readRevision(scope, selectedRevision); }
    catch { notFound(); }
  }
  const approved = new Map(approvals.map((item) => [item.revision, item]));

  return <section className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold">Versiones del plano</h1>
      <p className="text-sm text-slate-600">Cada guardado permanece en el historial. Recuperar una versión crea otra revisión y conserva la actual.</p>
    </div>
    {zones.length > 0 && <nav aria-label="Zona del historial" className="flex flex-wrap gap-2 text-sm">
      <a className={`rounded-lg border px-3 py-1.5 ${zoneId === null ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200'}`}
        href={versionHref(projectId, {})}>Plano principal</a>
      {zones.map((zone) => <a key={zone.id} className={`rounded-lg border px-3 py-1.5 ${zoneId === zone.id ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200'}`}
        href={versionHref(projectId, { zoneId: zone.id })}>{zone.name}</a>)}
    </nav>}
    {history.headRevision === null ? <p className="rounded-lg border p-4 text-sm text-slate-600">Esta zona aún no tiene versiones del editor.</p> :
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <ol className="space-y-2">
            {history.revisions.map((item) => <li key={item.revision} className={`rounded-lg border p-3 text-sm ${selectedRevision === item.revision ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <strong>Revisión {item.revision}</strong>
                {item.revision === history.headRevision && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">Actual</span>}
                {approved.has(item.revision) && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">Aprobada</span>}
              </div>
              <p className="text-slate-600">{new Date(item.createdAt).toLocaleString('es-ES')} · {item.furniture} muebles · {item.walls} muros</p>
              <a className="mt-1 inline-block font-medium text-emerald-800 underline" href={versionHref(projectId, { zoneId, page, revision: item.revision })}>Ver versión</a>
              {approved.get(item.revision) && <a className="ml-3 inline-block font-medium text-blue-800 underline"
                href={`/projects/${encodeURIComponent(projectId)}/editor?${new URLSearchParams({
                  ...(zoneId ? { zona: zoneId } : {}), aprobado: approved.get(item.revision)!.id,
                })}`}>Abrir diseño aprobado</a>}
            </li>)}
          </ol>
          <nav aria-label="Páginas de versiones" className="flex items-center justify-between pt-2 text-sm">
            {page > 1 ? <a className="underline" href={versionHref(projectId, { zoneId, page: page - 1 })}>← Más recientes</a> : <span />}
            <span>Página {page} de {pages}</span>
            {page < pages ? <a className="underline" href={versionHref(projectId, { zoneId, page: page + 1 })}>Más antiguas →</a> : <span />}
          </nav>
        </div>
        {preview ? <RevisionPreview key={`${zoneId}:${selectedRevision}`} scope={scope}
          draftScope={{ ...scope, userId: ctx.userId, organizationId: ctx.organizationId, zoneId }}
          document={preview} sourceRevision={selectedRevision!} headRevision={history.headRevision} /> :
          <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
            Elige una revisión para verla antes de recuperarla.
          </div>}
      </div>}
  </section>;
}
