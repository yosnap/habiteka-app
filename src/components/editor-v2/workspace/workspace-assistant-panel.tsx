'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useStore } from 'zustand';
import { Camera, Sofa, Sparkles, ArrowRight } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import ui from './workspace.module.css';

export function WorkspaceAssistantPanel({
  store,
  assistant,
  canGenerate,
  onGenerate,
  disabledReason,
  projectAvailable,
  processHref,
}: {
  store: EditorStore;
  assistant?: ReactNode;
  canGenerate: boolean;
  onGenerate: (intent: 'editable' | 'image') => void;
  disabledReason?: string;
  projectAvailable: boolean;
  processHref?: string;
}) {
  const document = useStore(store, (s) => s.document);
  const selection = useStore(store, (s) => s.selection);
  const level =
    document.levels?.find((item) => item.id === document.activeLevelId)?.name ?? 'Planta baja';
  return (
    <div className={ui.panelContent}>
      <h3 className={ui.assistantTitle}>
        <Sparkles size={20} aria-hidden="true" /> Diseñar con IA
      </h3>
      <p className={ui.hint}>Elige cómo trabajar sobre tu plano. Podrás revisar las opciones y el coste antes de generar.</p>
      {!canGenerate && <p role="status" className={ui.hint}>{disabledReason ?? 'El diseño con IA no está disponible en esta sesión.'}</p>}
      <div className={`${ui.actionCards} ${ui.assistantActions}`}>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('editable')}>
          <Sofa size={23} aria-hidden="true" />
          <span>
            <strong>Diseñar el plano con IA</strong>
            <small>Proponer muebles y acabados para revisar antes de aplicarlos</small>
          </span>
        </button>
        <button type="button" disabled={!canGenerate} onClick={() => onGenerate('image')}>
          <Camera size={23} aria-hidden="true" />
          <span>
            <strong>Generar diseños</strong>
            <small>Crear imágenes con IA: preparar vistas y opciones del diseño</small>
          </span>
        </button>
      </div>
      <div className={ui.contextCard}>
        <p className={ui.eyebrow}>Tu espacio de trabajo</p>
        <strong>{level}</strong>
        <p>
          {selection.length ? `${selection.length} elementos seleccionados` : 'Toda la planta'} ·
          revisión {document.revision}
        </p>
        <p className={ui.hint}>
          El asistente sigue el proyecto y su zona. La selección no se envía automáticamente a la
          IA.
        </p>
      </div>
      {assistant && processHref ? <div className={ui.assistantProcess}>
        <Link href={processHref}>Cambiar el proceso <ArrowRight size={18} aria-hidden="true" /></Link>
        <p className={ui.hint}>Abre el asistente por pasos en su página completa para revisar lo que quieres hacer. No reinicia ni borra tu plano.</p>
      </div> : (
        <p className={ui.hint}>
          {projectAvailable ? 'El proceso guiado no está disponible en esta vista.' : <>Esta muestra no usa servicios de IA. <Link href="/proyectos">Abre un proyecto</Link> para diseñar y conversar con el asistente.</>}
        </p>
      )}
    </div>
  );
}
