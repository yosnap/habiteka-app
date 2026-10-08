import { Check, FileImage, Images, LayoutTemplate, Clapperboard } from 'lucide-react';

interface Props {
  hasSource: boolean;
  hasImport: boolean;
  hasEditorPlan: boolean;
  hasDesignImages: boolean;
  hasVideo: boolean;
}

/** Estado del recorrido, separado de las pestañas que solo cambian la vista. */
export function StudioStageNav({
  hasSource,
  hasImport,
  hasEditorPlan,
  hasDesignImages,
  hasVideo,
}: Props) {
  const stages = [
    { name: 'Original', status: hasSource ? 'Listo' : 'Pendiente', icon: FileImage },
    {
      name: 'Plano editable',
      status: hasEditorPlan ? 'Listo' : hasImport ? 'Revisar medidas' : 'Pendiente',
      icon: LayoutTemplate,
    },
    { name: 'Diseños', status: hasDesignImages ? 'Imágenes guardadas' : 'Pendiente', icon: Images },
    { name: 'Vídeos', status: hasVideo ? 'Vídeo guardado' : 'Pendiente', icon: Clapperboard },
  ];
  return (
    <ol aria-label="Progreso del inmueble" className="flex flex-wrap gap-2">
      {stages.map((stage) => (
        <li
          key={stage.name}
          className="flex items-center gap-2 rounded-full bg-surface-muted px-3 py-2 text-xs"
        >
          <span className="text-ink-soft">{stage.status === 'Listo' ? <Check size={15} className="text-emerald-600" /> : <stage.icon size={15} />}</span>
          <span className="text-ink font-medium">{stage.name}</span>
          <span className={stage.status === 'Listo' ? 'text-emerald-700' : 'text-ink-soft'}>
            {stage.status}
          </span>
        </li>
      ))}
    </ol>
  );
}
