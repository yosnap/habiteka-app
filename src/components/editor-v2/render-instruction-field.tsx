'use client';
import { useState } from 'react';
import { ModernSelect } from '@/components/ui/modern-select';

const suggestions = [
  { id: 'none', label: 'Sin instrucciones adicionales', text: '' },
  { id: 'materials', label: 'Acabados naturales y tonos cálidos', text: 'Utiliza acabados naturales y tonos cálidos, conservando la construcción y las posiciones existentes.' },
  { id: 'minimal', label: 'Diseño limpio y despejado', text: 'Prioriza acabados sobrios y un ambiente despejado. Mantén libres todos los accesos y las zonas de circulación.' },
  { id: 'coherent', label: 'Unificar suelos y acabados', text: 'Busca continuidad visual entre el pavimento, las escaleras, las rampas y los descansillos sin cambiar sus medidas, alturas ni posiciones.' },
  { id: 'realistic', label: 'Visualización arquitectónica realista', text: 'Prioriza materiales realistas, proporciones exactas y sombras naturales. Evita reinterpretar la geometría del proyecto.' },
];

export function RenderInstructionField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [preset, setPreset] = useState('none');
  const [custom, setCustom] = useState(false);
  return <div className="space-y-2">
    <label className="text-ink-soft flex flex-col gap-1 text-sm">Instrucciones de diseño
      <ModernSelect compact value={custom ? 'custom' : preset} disabled={disabled} onChange={(event) => {
        const id = event.target.value;
        setCustom(id === 'custom');
        if (id !== 'custom') { setPreset(id); onChange(suggestions.find((item) => item.id === id)?.text ?? ''); }
      }}>
        {suggestions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        <option value="custom">Personalizar instrucciones…</option>
      </ModernSelect>
    </label>
    {custom ? <label className="text-ink-soft flex flex-col gap-1 text-sm">Tus instrucciones
      <textarea value={value} disabled={disabled} maxLength={500} rows={4} onChange={(e) => onChange(e.target.value)}
        placeholder="Describe los acabados y el ambiente que buscas…" className="border-line bg-surface resize-none rounded-control border px-2 py-1.5 text-sm" />
      <span className="text-xs">{value.length}/500 · Se respetan los permisos de decoración.</span>
    </label> : value && <div className="text-ink-soft text-xs"><p>{value}</p><button type="button" disabled={disabled} onClick={() => setCustom(true)} className="mt-1 underline">Personalizar este texto</button></div>}
  </div>;
}
