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
    { name: 'Original', status: hasSource ? 'Listo' : 'Pendiente' },
    {
      name: 'Plano editable',
      status: hasEditorPlan ? 'Listo' : hasImport ? 'Revisar medidas' : 'Pendiente',
    },
    { name: 'Diseño', status: hasDesignImages ? 'Imágenes guardadas' : 'Pendiente' },
    { name: 'Visita', status: 'Pendiente' },
    { name: 'Vídeo', status: hasVideo ? 'Vídeo guardado' : 'Pendiente' },
  ];
  return (
    <ol aria-label="Progreso del inmueble" className="flex flex-wrap gap-2">
      {stages.map((stage, index) => (
        <li
          key={stage.name}
          className="border-line bg-surface flex items-center gap-2 rounded-control border px-3 py-1.5 text-xs"
        >
          <span className="text-ink-soft tabular-nums">{index + 1}.</span>
          <span className="text-ink font-medium">{stage.name}</span>
          <span className={stage.status === 'Listo' ? 'text-emerald-700' : 'text-ink-soft'}>
            {stage.status}
          </span>
        </li>
      ))}
    </ol>
  );
}
