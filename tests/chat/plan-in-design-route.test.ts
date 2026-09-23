import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepSpace } from '@/components/chat/step-space';
import {
  interiorsEditorHref,
  parseAutoGenerate,
} from '@/components/editor-v2/auto-generate-request';

// El panel de fotos de la zona habla con el servidor; aquí solo interesa el aviso.
vi.mock('@/components/zones/zone-photos-panel', () => ({
  ZonePhotosPanel: () => null,
}));

const detected = { walls: 6, doors: 2, windows: 3, pillars: 0 };

function markup(imageKind: 'floor_plan' | 'room_photo' | null) {
  return renderToStaticMarkup(
    createElement(StepSpace, {
      projectId: 'p1',
      zoneId: null,
      detected,
      imageKind,
      onConvertPlan: () => {},
      disclaimer: null,
      pending: false,
      onUpload: () => {},
      onConfirm: () => {},
      onCorrect: () => {},
      onSkip: () => {},
    }),
  );
}

describe('plano subido en la ruta de diseño', () => {
  it('avisa y ofrece convertirlo al editor', () => {
    const html = markup('floor_plan');
    expect(html).toContain('Has subido un plano');
    expect(html).toContain('Convertir el plano al editor');
    // No bloquea: los controles para seguir igualmente siguen ahí.
    expect(html).toContain('Detecté');
  });

  it('no molesta cuando la imagen es una foto', () => {
    expect(markup('room_photo')).not.toContain('Has subido un plano');
    expect(markup(null)).not.toContain('Has subido un plano');
  });
});

describe('enlace del asistente al editor preparado', () => {
  it('lleva zona, petición de interiores y estilo', () => {
    expect(interiorsEditorHref('p1', 'z9', 'moderno')).toBe(
      '/projects/p1?zona=z9&generar=interiores&estilo=moderno',
    );
    expect(interiorsEditorHref('p1', null)).toBe('/projects/p1?generar=interiores');
  });

  it('solo pide vistas interiores con el parámetro exacto', () => {
    expect(parseAutoGenerate({ generar: 'interiores', estilo: 'moderno' })).toEqual({
      interiorRooms: true,
      estilo: 'moderno',
    });
    expect(parseAutoGenerate({ generar: 'interiores', estilo: 'inventado' })).toEqual({
      interiorRooms: true,
    });
    expect(parseAutoGenerate({ generar: 'otra-cosa' })).toBeNull();
    expect(parseAutoGenerate({})).toBeNull();
  });
});
