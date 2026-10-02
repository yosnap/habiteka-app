'use client';
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import { ModernSelect } from '@/components/ui/modern-select';
import { renderPresetSchema, transferableRenderOptions, type RenderDesignPreset } from '@/lib/editor-document/render-design-presets';
import { loadRenderPresets, saveRenderPreset, deleteRenderPreset } from '@/app/(app)/projects/[id]/_actions/render-preset-actions';
import { callAction } from '@/lib/action-result';

export function RenderPresetControls({ current, onLoad, onInstructionLoad, disabled }: {
  current: Omit<RenderDesignPreset, 'name'>;
  onInstructionLoad: (instruction: string) => void;
  onLoad: (preset: RenderDesignPreset) => void; disabled: boolean;
}) {
  const [pending, setPending] = useState(true);
  const [presets, setPresets] = useState<RenderDesignPreset[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  useMountEffect(() => {
    void callAction(loadRenderPresets()).then(setPresets)
      .catch(() => setMessage('No se pudieron leer las configuraciones guardadas.')).finally(() => setPending(false));
  });
  const persist = async (operation: ReturnType<typeof saveRenderPreset>) => {
    setPending(true);
    try { setPresets(await callAction(operation)); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuración.'); return false; }
    finally { setPending(false); }
  };
  disabled = disabled || pending;
  return <section className="mt-3 space-y-2 rounded-control border border-line p-3 text-sm" aria-label="Configuraciones guardadas">
    <p className="font-medium">Configuración e instrucciones reutilizables</p>
    <p className="text-xs text-ink-soft">Compartidas con tu organización, disponibles en otros inmuebles y navegadores. En cada inmueble elige sus estancias y zonas.</p>
    <div className="flex flex-wrap gap-2">
      <input aria-label="Nombre de la configuración" value={name} maxLength={60} disabled={disabled}
        className="rounded border border-line px-2 py-1" placeholder="Nombre de la configuración" onChange={(e) => setName(e.target.value)} />
      <button type="button" disabled={disabled} className="rounded border border-line px-2 py-1" onClick={async () => {
        const parsed = renderPresetSchema.safeParse({ name, ...current });
        if (!parsed.success) { setMessage('Escribe un nombre y completa las opciones antes de guardar.'); return; }
        const preset = { ...parsed.data, options: transferableRenderOptions(parsed.data.options) };
        if (await persist(saveRenderPreset(preset))) { setSelected(preset.name); setMessage('Configuración guardada.'); }
      }}>Guardar configuración</button>
    </div>
    {!!presets.length && <div className="flex flex-wrap items-center gap-2">
      <ModernSelect compact aria-label="Configuración guardada" value={selected} disabled={disabled} onChange={(e) => setSelected(e.target.value)}>
        <option value="">Elige una configuración</option>
        {presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
      </ModernSelect>
      <button type="button" disabled={disabled || !selected} className="rounded border border-line px-2 py-1" onClick={() => {
        const preset = presets.find((item) => item.name === selected);
        if (preset) { onLoad(preset); setName(preset.name); setMessage('Configuración cargada. Revisa el ámbito y las estancias.'); }
      }}>Cargar</button>
      <button type="button" disabled={disabled || !selected} className="rounded border border-line px-2 py-1" onClick={() => {
        const preset = presets.find((item) => item.name === selected);
        if (preset) { onInstructionLoad(preset.instruction); setMessage('Instrucciones cargadas.'); }
      }}>Cargar solo instrucciones</button>
      <button type="button" disabled={disabled || !selected} className="px-2 py-1 underline" onClick={async () => {
        if (await persist(deleteRenderPreset(selected))) { setSelected(''); setMessage('Configuración eliminada.'); }
      }}>Eliminar</button>
    </div>}
    {message && <p role="status" className="text-xs">{message}</p>}
  </section>;
}
