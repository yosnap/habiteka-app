'use client';

/**
 * Botón + diálogo mínimo para crear un proyecto. Al crearlo, navega directo a su
 * canvas para empezar a trabajar. Usa la Server Action `createProject` (que valida
 * sesión y rol en el servidor).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProject } from '@/server/actions/projects';

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);

  async function create() {
    const name = title.trim() || 'Proyecto sin título';
    setPending(true);
    try {
      const project = await createProject(name);
      // Un proyecto nuevo arranca en el asistente: el primer paso es subir la
      // foto y conversar, no el lienzo vacío.
      router.push(`/projects/${project.id}/chat`);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Nuevo proyecto
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Nombre del proyecto"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void create();
          if (e.key === 'Escape') setOpen(false);
        }}
        className="max-w-xs"
      />
      <Button type="button" onClick={create} disabled={pending}>
        {pending ? 'Creando…' : 'Crear'}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
        Cancelar
      </Button>
    </div>
  );
}
