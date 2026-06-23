'use client';

/**
 * Controles de la fase de INGESTA del asistente: subir foto, y cuando hay detección,
 * confirmarla / corregir los números a mano / subir otra foto / continuar igualmente.
 *
 * Encapsula el estado local de la UI (mostrar la subida, modo edición, borrador de
 * corrección) para que el chat solo cablee las acciones del agente. Las guardas reales
 * (no avanzar sin detección, etc.) viven en el servidor; aquí solo se ofrecen opciones.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedImage } from './image-upload';
import type { StructuralElements } from '@/lib/contracts';

interface Props {
  /** Detección actual (números) o null si aún no se ha analizado ninguna foto. */
  detected: StructuralElements | null;
  pending: boolean;
  onUpload: (image: UploadedImage) => void;
  onConfirm: () => void;
  onCorrect: (detected: StructuralElements) => void;
  onSkip: () => void;
}

const FIELDS: ReadonlyArray<{ key: keyof StructuralElements; label: string }> = [
  { key: 'walls', label: 'Muros' },
  { key: 'doors', label: 'Puertas' },
  { key: 'windows', label: 'Ventanas' },
  { key: 'pillars', label: 'Pilares' },
];

export function IngestaControls({ detected, pending, onUpload, onConfirm, onCorrect, onSkip }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StructuralElements>(
    detected ?? { walls: 0, doors: 0, windows: 0, pillars: 0 },
  );

  const handleUpload = (image: UploadedImage) => {
    setShowUpload(false);
    onUpload(image);
  };

  // Sin detección todavía, o el usuario pidió subir otra foto: mostrar la subida.
  if (detected === null || showUpload) {
    return (
      <div className="flex flex-col gap-2">
        <ImageUpload onUpload={handleUpload} disabled={pending} />
        {detected !== null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
            Cancelar
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={pending}>
            Continuar sin detectar (lo ajusto en el plano)
          </Button>
        )}
      </div>
    );
  }

  // Edición a mano de los números detectados.
  if (editing) {
    return (
      <div className="border-line bg-surface flex flex-col gap-2 rounded-control border p-3">
        <p className="text-ink text-sm font-medium">Corrige lo detectado</p>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="text-ink-soft flex items-center justify-between gap-2 text-sm">
              <span>{f.label}</span>
              <input
                type="number"
                min={0}
                value={draft[f.key]}
                disabled={pending}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.key]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))
                }
                className="border-line bg-surface text-ink w-20 rounded-control border px-2 py-1"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onCorrect(draft);
              setEditing(false);
            }}
            disabled={pending}
          >
            Guardar corrección
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Vista por defecto con detección: confirmar / corregir / re-subir / continuar.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm} disabled={pending}>
          Confirmar y continuar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(detected);
            setEditing(true);
          }}
          disabled={pending}
        >
          Corregir números
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowUpload(true)} disabled={pending}>
          No es correcto — subir otra foto
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={pending}>
          Continuar igualmente
        </Button>
      </div>
    </div>
  );
}
