'use client';

/**
 * Subida de una imagen del espacio (foto o boceto) para la fase de ingesta. Lee el
 * archivo en el navegador, lo convierte a base64 y lo entrega al chat, que dispara
 * la acción 'ingest' del agente. La validación real (tipo por bytes, tamaño, strip
 * de EXIF) la hace la capa de IA en el servidor; aquí solo se acota el tipo y el
 * tamaño para dar feedback temprano.
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMountEffect } from '@/lib/use-mount-effect';
import { checkImageConsent, grantImageConsent } from '@/server/actions/image-consent';

/** Límite de cliente (defensa temprana; el servidor reaplica el suyo). */
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadedImage {
  base64: string;
  mimeType: string;
}

interface Props {
  onUpload: (image: UploadedImage) => void;
  disabled?: boolean;
}

export function ImageUpload({ onUpload, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // null = cargando estado de consentimiento; true/false = ya conocido.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [granting, setGranting] = useState(false);

  useMountEffect(() => {
    void checkImageConsent()
      .then(setConsented)
      .catch(() => setConsented(false));
  });

  async function grant() {
    setGranting(true);
    try {
      await grantImageConsent();
      setConsented(true);
    } finally {
      setGranting(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Sube una imagen (foto o boceto).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen supera el tamaño máximo (10 MB).');
      return;
    }
    const base64 = await fileToBase64(file);
    onUpload({ base64, mimeType: file.type });
  }

  // Sin consentimiento de tratamiento de imágenes, no se permite subir (RGPD).
  if (consented === false) {
    return (
      <div className="border-line bg-surface-muted flex flex-col gap-2 rounded-control border p-3 text-sm">
        <p className="text-ink-soft">
          Para analizar tu foto con IA necesitamos tu consentimiento. La imagen se trata según
          nuestra política de privacidad (se eliminan los metadatos y se difuminan las caras antes
          de procesarla).
        </p>
        <Button type="button" size="sm" onClick={grant} disabled={granting}>
          {granting ? 'Guardando…' : 'Acepto y quiero subir mi foto'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || consented === null}
        onClick={() => inputRef.current?.click()}
      >
        📷 Subir foto o boceto del espacio
      </Button>
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

/** Convierte un archivo a base64 sin el prefijo `data:` (solo el contenido). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}
