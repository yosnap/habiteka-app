'use client';

/**
 * Botón para crear un proyecto nuevo con flujo de 2 pasos:
 * 1. Nombre del proyecto.
 * 2. Template picker — elige plantilla builtin o lienzo en blanco.
 *
 * Si elige plantilla → navega al canvas con el doc ya cargado.
 * Si elige en blanco → navega al chat (flujo original).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProject } from '@/server/actions/projects';
import { saveCanvas } from '@/server/actions/canvas';
import { serializeCanvas } from '@/canvas/serialize';
import { TemplatePickerModal } from '@/components/templates/template-picker-modal';
import type { BuiltinTemplate } from '@/canvas/templates';

type Step = 'idle' | 'naming' | 'picking' | 'creating';

export function NewProjectButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [title, setTitle] = useState('');

  function openNaming() {
    setTitle('');
    setStep('naming');
  }

  function cancel() {
    setStep('idle');
    setTitle('');
  }

  function goToPicking() {
    if (!title.trim()) return;
    setStep('picking');
  }

  /** Crea el proyecto y navega al canvas con la plantilla pre-cargada. */
  async function createWithTemplate(template: BuiltinTemplate) {
    setStep('creating');
    const name = title.trim() || 'Proyecto sin título';
    const project = await createProject(name);
    await saveCanvas(project.id, serializeCanvas(template.doc));
    router.push(`/projects/${project.id}`);
  }

  /** Crea el proyecto en blanco y navega al chat (flujo original). */
  async function createBlank() {
    setStep('creating');
    const name = title.trim() || 'Proyecto sin título';
    const project = await createProject(name);
    router.push(`/projects/${project.id}/chat`);
  }

  if (step === 'idle') {
    return (
      <Button type="button" onClick={openNaming}>
        Nuevo proyecto
      </Button>
    );
  }

  if (step === 'naming') {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Nombre del proyecto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goToPicking();
            if (e.key === 'Escape') cancel();
          }}
          className="max-w-xs"
        />
        <Button type="button" onClick={goToPicking} disabled={!title.trim()}>
          Siguiente →
        </Button>
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  // 'picking' | 'creating'
  return (
    <TemplatePickerModal
      projectName={title.trim() || 'Proyecto sin título'}
      onSelect={createWithTemplate}
      onSkip={createBlank}
      disabled={step === 'creating'}
    />
  );
}
