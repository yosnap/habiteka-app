import type { ReactNode } from 'react';
import { ArrowRight, DraftingCompass, FileUp, PencilRuler } from 'lucide-react';

export function StudioEntryChoices({ upload, drawing, pending, hasImport, onSketch, onEditor, onImport }: {
  upload: ReactNode; drawing: boolean; pending: boolean; hasImport: boolean;
  onSketch: () => void; onEditor: () => void; onImport: () => void;
}) {
  const choices = [
    { label: drawing ? 'Cerrar el boceto' : 'Dibujar un boceto', detail: 'Traza los muros de tu idea.', icon: PencilRuler, color: 'bg-violet-100 text-violet-700', onClick: onSketch },
    { label: hasImport ? 'Continuar importación' : 'Importar CAD o PDF', detail: 'Lee el plano y revisa sus medidas.', icon: FileUp, color: 'bg-sky-100 text-sky-700', onClick: onImport },
    { label: 'Usar mi plano del editor', detail: 'Continúa desde lo que ya has dibujado.', icon: DraftingCompass, color: 'bg-amber-100 text-amber-700', onClick: onEditor },
  ];
  return <div className="grid gap-4 text-left sm:grid-cols-2">
    <section className="flex flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5"><h2 className="mb-2 font-semibold">Subir una foto del plano</h2><p className="mb-4 text-sm text-ink-soft">Empieza desde una imagen o un escaneo.</p>{upload}</section>
    {choices.map(({ label, detail, icon: Icon, color, onClick }) => <button type="button" key={label} disabled={pending} onClick={onClick}
      className="group flex min-h-40 flex-col items-start rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-brand-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50">
      <span className={`mb-4 grid size-12 place-items-center rounded-2xl ${color}`}><Icon size={25} /></span>
      <span className="flex w-full items-center justify-between gap-2 font-semibold">{label}<ArrowRight size={16} /></span><span className="mt-1 text-sm text-ink-soft">{detail}</span>
    </button>)}
  </div>;
}
