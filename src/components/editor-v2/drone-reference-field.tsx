'use client';
import { useState } from 'react';

export function DroneReferenceField({ value, onChange, disabled, savedSite = false }: {
  savedSite?: boolean;
  value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  if (savedSite) return <section className="mt-3 rounded-control border border-line p-3 text-sm">
    <p className="font-medium">Ortofoto de la parcela confirmada</p>
    <p className="text-xs text-ink-soft">Se usa la copia guardada en «Parcela real» con su posición y orientación.
      La isométrica requiere una cenital aceptada; el dron requiere la isométrica del mismo diseño, luz y libertad.</p>
  </section>;
  return <section className="mt-3 space-y-2 rounded-control border border-line p-3 text-sm">
    <label className="flex flex-col gap-2 font-medium">Ortofoto para las vistas lejanas (obligatoria en dron y exterior, opcional en isométrica)
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10_000_000) {
          setError('Elige una imagen PNG, JPEG o WebP de hasta 10 MB.'); return;
        }
        const reader = new FileReader();
        reader.onload = () => { if (typeof reader.result === 'string') { onChange(reader.result); setError(null); } };
        reader.onerror = () => setError('No se pudo leer la ortofoto.');
        reader.readAsDataURL(file);
      }} />
    </label>
    <p className="text-ink-soft text-xs">Genera primero una cenital del mismo diseño, luz y libertad. La isométrica deriva de ella y el dron requiere la isométrica.
      La ortofoto define el entorno; la casa conserva todos sus elementos, incluidas pérgolas y terrazas. Sin ortofoto, la isométrica muestra solo el terreno modelado con fondo neutro.</p>
    {value && <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value} alt="Ortofoto seleccionada" className="h-20 w-32 rounded object-cover" />
      <button type="button" disabled={disabled} className="text-xs underline" onClick={() => onChange('')}>Quitar ortofoto</button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
