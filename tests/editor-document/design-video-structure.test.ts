import { describe, expect, it } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { designVideoStructure } from '@/lib/editor-document/design-video-structure';

function document() {
  const doc = twoRoomDocument();
  const common = { widthMm: 1000, depthMm: 2000, heightMm: 1000, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' };
  doc.stairs = [{ ...common, id: 'a', x: 0, y: 5000, kind: 'straight', catalogId: 'builtin:stair-straight', stepCount: 16 },
    { ...common, id: 'b', x: 8000, y: 5000, kind: 'L', catalogId: 'builtin:stair-L', stepCount: 20 }];
  doc.ramps = [{ ...common, id: 'ramp', x: 1000, y: 5000, catalogId: 'builtin:ramp', riseMm: 1000 },
    { ...common, id: 'landing', x: 0, y: 7000, catalogId: 'builtin:ramp', riseMm: 0 }];
  doc.furniture = [{ id: 'bed', kind: 'cama', x: 1000, y: 1000, rotation: 0, widthMm: 1400, depthMm: 2000, dimensionalOrigin: 'physical' }];
  return doc;
}
describe('accesos estructurales del ámbito de las fotos', () => {
  it('identifica escaleras, rampa y descansillo sin convertir todo en escaleras ni incorporar muebles', () => {
    const result = designVideoStructure(document(), [{ options: defaultRenderDesignOptions() }]);
    expect(result).toContain('exactamente 2 escaleras, 1 rampas inclinadas y 1 descansillos planos');
    expect(result).toContain('recta, sin giro'); expect(result).toContain('forma L');
    expect(result).toContain('superficie inclinada continua, sin peldaños');
    expect(result).toContain('plataforma horizontal'); expect(result).not.toContain('cama'); expect(result).not.toContain('bed');
    expect(result).toContain('X=8.00 m');
  });
  it('omite accesos fuera de los polígonos elegidos y une selecciones sin duplicar elementos', () => {
    const options = { ...defaultRenderDesignOptions(), designScope: 'rooms' as const, placement: 'selected' as const,
      regions: [{ id: 'entry', name: 'Acceso izquierdo', polygon: [{ x: -1, y: 4999 }, { x: 999, y: 4999 }, { x: 999, y: 8999 }, { x: -1, y: 8999 }] }] };
    const result = designVideoStructure(document(), [{ options }, { options }]);
    expect(result).toContain('exactamente 1 escaleras, 0 rampas inclinadas y 1 descansillos planos');
    expect(result).not.toContain('X=8.00 m');
  });
  it('el permiso para rediseñar cocina y sanitarios no permite alterar accesos estructurales', () => {
    const result = designVideoStructure(document(), [{ options: { ...defaultRenderDesignOptions(), redesignFixed: true } }]);
    expect(result).toContain('exactamente 2 escaleras'); expect(result).toContain('No añadir, duplicar, desplazar');
  });
});
