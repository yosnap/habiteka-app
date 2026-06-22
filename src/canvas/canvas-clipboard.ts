/**
 * Portapapeles interno del editor de planos (no el del sistema operativo).
 *
 * Vive a NIVEL DE MÓDULO, fuera del componente del workspace, a propósito: el
 * workspace se re-monta al cambiar de zona (key por zona), y un portapapeles
 * guardado en el componente se perdería en ese re-montaje. Al vivir aquí, copiar o
 * cortar en una zona y pegar en otra funciona (caso de uso natural del multi-zona).
 *
 * Solo guarda objetos (`StructObj`); es efímero en memoria de la pestaña (no se
 * persiste). `pasteSeq` da ids únicos a los pegados para no colisionar.
 */
import type { StructObj } from './types';

let buffer: StructObj[] = [];
let pasteSeq = 0;

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
 * para insertar. Cada llamada avanza la secuencia para que pegados sucesivos no
 * colisionen en id ni se solapen exactamente.
 */
export function takeClipboardClones(offset = 20): StructObj[] {
  return buffer.map((o) => {
    pasteSeq += 1;
    return { ...o, id: `obj-paste-${pasteSeq}`, x: o.x + offset, y: o.y + offset };
  });
}
