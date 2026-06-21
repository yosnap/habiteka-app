'use client';

/**
 * Controles de iluminación para el objeto seleccionado, cuando es una luz de
 * primera clase (F-LUZ). Muestra color e intensidad y los aplica al objeto vía el
 * store. Se separa de la toolbar para no inflarla; solo se renderiza si la
 * selección es una luz.
 */
import { useCanvasStore } from '@/canvas/canvas-store';
import { isLight, defaultLight, clampIntensity } from '@/canvas/light';

export function LightControls() {
  const selection = useCanvasStore((s) => s.doc.selection);
  const objects = useCanvasStore((s) => s.doc.objects);
  const updateObjects = useCanvasStore((s) => s.updateObjects);

  const selectedIds = selection?.type === 'object' ? selection.objectIds : [];
  // Solo objetos-luz de la selección: el panel aplica a todos ellos.
  const lightIds = objects.filter((o) => selectedIds.includes(o.id) && isLight(o.kind)).map((o) => o.id);
  if (lightIds.length === 0) return null;

  const ref = objects.find((o) => o.id === lightIds[0]);
  const light = ref?.light ?? defaultLight();

  const setLight = (patch: Partial<typeof light>) => {
    updateObjects(lightIds, { light: { ...light, ...patch } });
  };

  return (
    <>
      <span className="bg-border mx-1 h-5 w-px" aria-hidden />
      <label className="text-ink-soft flex items-center gap-1 text-xs">
        Luz
        <input
          type="color"
          value={light.color}
          onChange={(e) => setLight({ color: e.target.value })}
          className="h-6 w-8 cursor-pointer rounded-[var(--radius-control)] border border-line"
          aria-label="Color de la luz"
          title="Color de la luz"
        />
      </label>
      <label className="text-ink-soft flex items-center gap-1 text-xs">
        Intensidad
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={light.intensidad}
          onChange={(e) => setLight({ intensidad: clampIntensity(Number(e.target.value)) })}
          className="w-20"
          aria-label="Intensidad de la luz"
          title="Intensidad de la luz"
        />
      </label>
    </>
  );
}
