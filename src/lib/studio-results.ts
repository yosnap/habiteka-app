import type { StudioImage, StudioResult, StudioState } from './studio-state';

/** Recupera las referencias de estados anteriores sin inventar una fecha histórica. */
export function studioResults(state: StudioState): StudioResult[] {
  const results = [...(state.results ?? [])];
  const addLegacy = (
    ref: StudioImage | undefined,
    details: Omit<StudioResult, 'id' | 'assetKey' | 'createdAt'>,
  ) => {
    if (!ref?.assetKey || results.some((item) => item.assetKey === ref.assetKey)) return;
    results.push({ id: ref.assetKey, assetKey: ref.assetKey, createdAt: null, ...details });
  };
  addLegacy(state.source, { kind: 'source' });
  for (const mode of ['tecnico', 'decorado'] as const) {
    const ref = state.redraws?.[mode];
    addLegacy(state.redraws?.[mode], {
      kind: 'redraw',
      mode,
      // Solo se conoce el origen del redibujado activo; estados antiguos
      // podían conservar redibujados tras sustituir el original.
      ...(ref?.assetKey && ref.assetKey === state.plan?.assetKey && state.source?.assetKey
        ? { sourceKey: state.source.assetKey }
        : {}),
    });
  }
  addLegacy(state.cenital, {
    kind: 'render',
    vista: state.vista ?? 'cenital',
    ...(state.estilo ? { estilo: state.estilo } : {}),
  });
  return results;
}

/** Añade una generación al historial del proyecto sin guardar enlaces temporales. */
export function appendStudioResult(
  state: StudioState,
  ref: StudioImage,
  details: Omit<StudioResult, 'id' | 'assetKey' | 'createdAt'>,
): StudioResult[] {
  const previous = studioResults(state);
  if (!ref.assetKey || previous.some((item) => item.assetKey === ref.assetKey)) return previous;
  return [
    ...previous,
    {
      id: ref.assetKey,
      assetKey: ref.assetKey,
      createdAt: new Date().toISOString(),
      ...details,
    },
  ];
}
