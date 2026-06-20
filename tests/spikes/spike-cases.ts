/**
 * Lectura del set de entradas del spike (`docs/spikes/calidad-ia/inputs/`).
 *
 * Compartido por el arnés de calidad de imagen y el de detección de visión, para
 * que ambos recorran exactamente las mismas entradas.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SpikeCase {
  id: string;
  file: string;
  kind: 'boceto' | 'foto';
  prompt: string;
  groundTruth?: { walls: number; doors: number; windows: number; pillars: number };
}

export const SPIKE_DIR = join(process.cwd(), 'docs', 'spikes', 'calidad-ia');
export const INPUTS_DIR = join(SPIKE_DIR, 'inputs');
export const SAMPLES_DIR = join(SPIKE_DIR, 'samples');

/** Indica si el arnés debe ejecutar llamadas reales (requiere `RUN_SPIKE=true`). */
export function spikeEnabled(): boolean {
  return process.env.RUN_SPIKE === 'true';
}

/** Carga los casos declarados en `inputs/cases.json`. */
export async function loadCases(): Promise<SpikeCase[]> {
  const raw = await readFile(join(INPUTS_DIR, 'cases.json'), 'utf8');
  return JSON.parse(raw) as SpikeCase[];
}

/** Lee el buffer de la imagen de una entrada. */
export async function readInputImage(c: SpikeCase): Promise<Buffer> {
  return readFile(join(INPUTS_DIR, c.file));
}
