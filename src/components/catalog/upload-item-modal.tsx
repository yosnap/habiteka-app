'use client';

/**
 * Modal para subir un item custom al catálogo de la org.
 * Valida localmente (tipo + tamaño) antes de enviar al servidor.
 * El servidor re-valida todo incluyendo magic bytes del GLB.
 */
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'mobiliario', label: 'Mobiliario' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'sanitarios', label: 'Sanitarios' },
  { id: 'iluminacion', label: 'Iluminación' },
  { id: 'decoracion', label: 'Decoración' },
  { id: 'dormitorio', label: 'Dormitorio' },
  { id: 'exterior', label: 'Exterior' },
];

interface UploadedItem {
  id: string;
  kind: string;
  label: string;
  category: string;
  thumbnailUrl: string | null;
  widthM: number;
  depthM: number;
}

interface Props {
  onClose: () => void;
  onSuccess: (item: UploadedItem) => void;
}

export function UploadItemModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]?.id ?? 'mobiliario');
  const [family, setFamily] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [depthCm, setDepthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [model, setModel] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const thumbRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);

  function handleThumbnail(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('La miniatura debe ser JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La miniatura no puede superar 5 MB.');
      return;
    }
    setError(null);
    setThumbnail(file);
    setThumbPreview(URL.createObjectURL(file));
  }

  function handleModel(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setError('El modelo debe ser un archivo .glb.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('El modelo GLB no puede superar 25 MB.');
      return;
    }
    setError(null);
    setModel(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('El nombre es obligatorio.');
    if (!thumbnail) return setError('La miniatura es obligatoria.');
    const w = parseFloat(widthCm);
    const d = parseFloat(depthCm);
    if (isNaN(w) || w <= 0) return setError('El ancho debe ser un número positivo.');
    if (isNaN(d) || d <= 0) return setError('La profundidad debe ser un número positivo.');

    setSubmitting(true);
    const form = new FormData();
    form.set('name', name.trim());
    form.set('category', category);
    if (family.trim()) form.set('family', family.trim());
    form.set('widthM', String(w / 100));
    form.set('depthM', String(d / 100));
    form.set('heightM', String((parseFloat(heightCm) || 0) / 100));
    form.set('thumbnail', thumbnail);
    if (model) form.set('model', model);

    try {
      const res = await fetch('/api/catalog/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al subir el elemento.');
        return;
      }
      onSuccess({ ...data, thumbnailUrl: thumbPreview });
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border-line w-full max-w-sm rounded-xl border shadow-xl">
        {/* Header */}
        <div className="border-line flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-ink text-sm font-semibold">Añadir elemento</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink rounded p-1"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {/* Miniatura */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs font-medium">
              Miniatura <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => thumbRef.current?.click()}
              className={cn(
                'border-line flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors',
                thumbnail ? 'border-brand-400' : 'hover:border-brand-400 hover:bg-brand-50',
              )}
            >
              {thumbPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbPreview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-ink-soft text-xs">JPG / PNG / WebP (máx 5 MB)</span>
              )}
            </button>
            <input
              ref={thumbRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleThumbnail(e.target.files?.[0])}
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs font-medium">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Sofá vintage"
              className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
              required
            />
          </div>

          {/* Categoría + Familia */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-ink-soft mb-1 block text-xs font-medium">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-ink-soft mb-1 block text-xs font-medium">
                Familia <span className="text-ink-soft font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="Ej.: Sofás"
                className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Dimensiones */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs font-medium">
              Dimensiones (cm) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="Ancho"
                  min="1"
                  step="1"
                  className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                  placeholder="Prof."
                  min="1"
                  step="1"
                  className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="Alto"
                  min="0"
                  step="1"
                  className="border-line bg-surface text-ink w-full rounded-control border px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <p className="text-ink-soft mt-0.5 text-[10px]">Ancho · Profundidad · Alto (opcional)</p>
          </div>

          {/* Modelo GLB */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs font-medium">
              Modelo 3D{' '}
              <span className="text-ink-soft font-normal">.glb · opcional · máx 25 MB</span>
            </label>
            <button
              type="button"
              onClick={() => modelRef.current?.click()}
              className={cn(
                'border-line w-full rounded-control border px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-muted',
                model ? 'text-brand-600 font-medium' : 'text-ink-soft',
              )}
            >
              {model ? `✓ ${model.name}` : 'Seleccionar .glb…'}
            </button>
            <input
              ref={modelRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={(e) => handleModel(e.target.files?.[0])}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-ink-soft hover:text-ink rounded-control px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-control bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {submitting ? 'Subiendo…' : 'Añadir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
