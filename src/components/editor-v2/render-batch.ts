export interface RenderBatchState<T> {
  results: Array<T | undefined>;
  referenceDesignId?: string;
  stopped: boolean;
  error?: unknown;
}

/** Ejecuta un lote secuencial, conserva éxitos y permite reanudar solo pendientes. */
export async function runRenderBatch<T extends { id?: string }, I>(input: {
  items: I[];
  initialResults?: Array<T | undefined>;
  render: (item: I, index: number, referenceDesignId?: string) => Promise<T>;
  shouldStop: () => boolean;
  onResult?: (result: T, index: number, results: Array<T | undefined>) => void;
}): Promise<RenderBatchState<T>> {
  const results = [...(input.initialResults ?? [])];
  let referenceDesignId: string | undefined;
  let stopped = false;
  let error: unknown;

  for (let index = 0; index < input.items.length; index += 1) {
    if (input.shouldStop()) {
      stopped = true;
      break;
    }
    const existing = results[index];
    if (existing) {
      referenceDesignId ??= existing.id;
      continue;
    }
    try {
      const result = await input.render(input.items[index]!, index, referenceDesignId);
      results[index] = result;
      referenceDesignId ??= result.id;
      input.onResult?.(result, index, [...results]);
    } catch (cause) {
      error = cause;
      break;
    }
  }

  return { results, referenceDesignId, stopped, ...(error === undefined ? {} : { error }) };
}
