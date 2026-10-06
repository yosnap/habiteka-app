import { Button } from '@/components/ui/button';
import type { StudioResultView } from '@/lib/studio-state';

export interface StudioDeliverableView {
  id: string;
  type: 'PLANO_2D' | 'RENDER_3D' | 'MEMORIA' | 'VIDEO';
  version: number;
  createdAt: string;
  url: string | null;
}

interface Props {
  projectId: string;
  results: StudioResultView[];
  deliverables: StudioDeliverableView[];
  hasImport: boolean;
  activeKey?: string;
  selectedKey?: string;
  onOpen: (result: StudioResultView) => void;
  onCompare: (result: StudioResultView) => void;
  onContinue: (result: StudioResultView) => void;
  onReviewImport: () => void;
  /** Imagen que es ahora el fondo del editor. */
  backgroundKey?: string | null;
  /** Solo con un plano en el editor: usa el boceto o un redibujado como su fondo. */
  onBackground?: (result: StudioResultView) => void;
}

const label = (item: StudioResultView) =>
  item.kind === 'source'
    ? 'Original'
    : item.kind === 'canvas'
      ? 'Captura del editor'
    : item.kind === 'redraw'
      ? `Redibujado ${item.mode === 'decorado' ? 'decorado' : 'técnico'}`
      : item.vista === 'maqueta'
        ? 'Maqueta · imagen'
        : 'Cenital · imagen';

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Fecha anterior no disponible';

/** Solo muestra activos realmente persistidos; cada URL se renueva al cargar. */
export function StudioResultsPanel({
  projectId,
  results,
  deliverables,
  hasImport,
  activeKey,
  selectedKey,
  onOpen,
  onCompare,
  onContinue,
  onReviewImport,
  backgroundKey,
  onBackground,
}: Props) {
  const newest = [...results].reverse();
  return (
    <section
      aria-label="Resultados del proyecto"
      className="border-line bg-surface rounded-card border p-3"
    >
      <h2 className="text-ink text-sm font-semibold">Resultados del proyecto</h2>
      <p className="text-ink-soft mt-1 text-xs">
        Abre y compara cada imagen. «Usar este plano» cambia el plano de trabajo, no borra
        resultados.
      </p>
      {newest.length === 0 && !hasImport && deliverables.length === 0 ? (
        <p className="text-ink-soft mt-3 text-xs">Todavía no hay resultados guardados.</p>
      ) : null}
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {newest.map((item) => {
          const source = results.find(
            (candidate) => candidate.kind === 'source' && candidate.assetKey === item.sourceKey,
          );
          const version =
            results
              .filter((candidate) => candidate.kind === item.kind)
              .findIndex((candidate) => candidate.id === item.id) + 1;
          const sourceVersion = source
            ? results
                .filter((candidate) => candidate.kind === 'source')
                .findIndex((candidate) => candidate.id === source.id) + 1
            : null;
          return (
            <li
              key={item.id}
              className={`border-line rounded-control border p-2 ${selectedKey === item.assetKey ? 'ring-2 ring-primary/30' : ''}`}
            >
              <div className="flex gap-2">
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada del storage.
                  <img
                    src={item.url}
                    alt=""
                    className="bg-white h-14 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted text-ink-soft grid h-14 w-14 shrink-0 place-items-center rounded text-[10px]">
                    Sin vista
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-xs font-medium">
                    {label(item)} · v{version}
                  </p>
                  <p className="text-ink-soft text-[11px]">{date(item.createdAt)}</p>
                  {source ? (
                    <p className="text-ink-soft truncate text-[11px]">
                      Origen: original v{sourceVersion}
                    </p>
                  ) : null}
                  {activeKey === item.assetKey ? (
                    <p className="text-emerald-700 text-[11px]">Plano de trabajo</p>
                  ) : null}
                  {activeKey !== item.assetKey ? (
                    <p className="text-ink-soft text-[11px]">Guardado</p>
                  ) : null}
                  {backgroundKey === item.assetKey ? (
                    <p className="text-brand-700 text-[11px]">Fondo del editor</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!item.url}
                  onClick={() => onOpen(item)}
                >
                  Abrir
                </Button>
                {item.kind !== 'source' && source?.url ? (
                  <Button size="xs" variant="outline" onClick={() => onCompare(item)}>
                    Comparar
                  </Button>
                ) : null}
                {onBackground && (item.kind === 'source' || item.kind === 'redraw') && backgroundKey !== item.assetKey ? (
                  <Button size="xs" variant="outline" onClick={() => onBackground(item)}>
                    Usar de fondo en el editor
                  </Button>
                ) : null}
                {(item.kind === 'source' || item.kind === 'canvas' || (item.kind === 'redraw' && source)) &&
                activeKey !== item.assetKey ? (
                  <Button size="xs" variant="ghost" onClick={() => onContinue(item)}>
                    Usar este plano
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
        {hasImport ? (
          <li className="border-line rounded-control border p-2 text-xs">
            <p className="text-ink font-medium">Extracción vectorial · última revisión guardada</p>
            <p className="text-ink-soft mt-1">
              Muros y medidas en revisión; no es un render ni una visita 3D.
            </p>
            <Button size="xs" variant="outline" className="mt-2" onClick={onReviewImport}>
              Revisar medidas
            </Button>
          </li>
        ) : null}
        {deliverables.map((item) => (
          <li key={item.id} className="border-line rounded-control border p-2">
            <div className="flex gap-2">
              {item.url && item.type === 'RENDER_3D' ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada del storage.
                <img src={item.url} alt="" className="bg-white h-14 w-14 rounded object-cover" />
              ) : null}
              <div className="text-xs">
                <p className="text-ink font-medium">
                  {item.type === 'VIDEO'
                    ? 'Vídeo'
                    : item.type === 'RENDER_3D'
                      ? 'Render'
                      : item.type === 'PLANO_2D'
                        ? 'Plano 2D'
                        : 'Memoria'}{' '}
                  · versión {item.version}
                </p>
                <p className="text-ink-soft">{date(item.createdAt)}</p>
                <a
                  className="text-brand-700 underline"
                  href={`/projects/${projectId}/deliverables`}
                >
                  Abrir entregable
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
