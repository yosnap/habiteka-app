/**
 * Portapapeles interno del editor de planos (no el del sistema operativo).
 *
 * Vive a NIVEL DE MÓDULO, fuera del componente del workspace, a propósito: el
 * workspace se re-monta al cambiar de zona (key por zona), y un portapapeles
 * guardado en el componente se perdería en ese re-montaje. Al vivir aquí, copiar o
 * cortar en una zona y pegar en otra funciona (caso de uso natural del multi-zona).
 *
 * Solo guarda objetos (`StructObj`); es efímero en memoria de la pestaña (no se
 * persiste). Los pegados reciben ids por UUID para no colisionar con los originales
 * ni entre pegados de distintas sesiones (un contador de módulo reiniciaría a 0 al
 * recargar y repetiría ids ya usados).
 */
import type { StructObj } from './types';

let buffer: StructObj[] = [];

/** Copia un conjunto de objetos al portapapeles (reemplaza el contenido previo). */
export function setClipboard(objects: StructObj[]): void {
  buffer = objects;
}

/** ¿Hay algo que pegar? */
export function hasClipboard(): boolean {
  return buffer.length > 0;
}

/**
 * Devuelve clones de los objetos copiados, desplazados y con ids nuevos, listos
 * para insertar. Cada clon recibe un id único (UUID) para no colisionar ni
 * solaparse exactamente con los originales ni con pegados anteriores.
 */
export function takeClipboardClones(offset = 20): StructObj[] {
  return buffer.map((o) => ({
    ...o,
    id: `obj-paste-${globalThis.crypto.randomUUID()}`,
    x: o.x + offset,
    y: o.y + offset,
  }));
}
