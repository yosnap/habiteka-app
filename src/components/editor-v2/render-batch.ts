export interface RenderBatchState<T> {
  results: Array<T | undefined>;
  stopped: boolean;
  error?: unknown;
  failures: { index: number; error: unknown }[];
}

/** El fallo que detiene el lote no debe ocultar los descartes de vistas anteriores. */
export function renderBatchFailureMessage(
  state: Pick<RenderBatchState<unknown>, 'failures' | 'error'>,
  labelAt: (index: number) => string,
): string | null {
  if (state.failures.length) return state.failures.map(({ index, error }) =>
    `${labelAt(index)}: ${error instanceof Error ? error.message : 'No se pudo completar esta imagen.'}`,
  ).join('\n');
  return state.error === undefined ? null
    : state.error instanceof Error ? state.error.message : 'No se pudo completar el lote de renders.';
}

/** Ejecuta un lote secuencial, conserva éxitos y permite reanudar solo pendientes. */
export async function runRenderBatch<T, I>(input: {
  items: I[];
  initialResults?: Array<T | undefined>;
  render: (item: I, index: number) => Promise<T>;
  shouldStop: () => boolean;
  onResult?: (result: T, index: number, results: Array<T | undefined>) => void;
  continueOnError?: (error: unknown) => boolean;
}): Promise<RenderBatchState<T>> {
  const results = [...(input.initialResults ?? [])];
  let stopped = false;
  let error: unknown;
  const failures: { index: number; error: unknown }[] = [];

  for (let index = 0; index < input.items.length; index += 1) {
    if (input.shouldStop()) {
      stopped = true;
      break;
    }
    const existing = results[index];
    if (existing) continue;
    try {
      const result = await input.render(input.items[index]!, index);
      results[index] = result;
      input.onResult?.(result, index, [...results]);
    } catch (cause) {
      failures.push({ index, error: cause });
      if (input.continueOnError?.(cause)) continue;
      error = cause;
      break;
    }
  }

  return { results, stopped, failures, ...(error === undefined ? {} : { error }) };
}
