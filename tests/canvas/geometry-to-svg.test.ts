/**
 * Renderer SVG del plano técnico: geometría correcta, simbología presente,
 * textos escapados y salida determinista.
 */
import { describe, expect, it } from 'vitest';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { doorSymbol } from '@/lib/plan-svg/architectural-symbols';
import { DEFAULT_PLAN_SVG_THEME } from '@/lib/plan-svg/plan-svg-theme';
import type { Plano2dPayload } from '@/lib/contracts';

/** Sala rectangular 4×3 m con puerta al sur, ventana al norte y una cota. */
function room(name = 'Salón'): Plano2dPayload {
  const corners = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ];
  return {
    schemaVersion: 1,
    zones: [
      {
        id: 'z0',
        name,
        outline: corners,
        walls: [
          { id: 'w0', from: corners[0]!, to: corners[1]!, thicknessMm: 120 },
          { id: 'w1', from: corners[1]!, to: corners[2]!, thicknessMm: 120 },
          { id: 'w2', from: corners[2]!, to: corners[3]!, thicknessMm: 120 },
          { id: 'w3', from: corners[3]!, to: corners[0]!, thicknessMm: 120 },
        ],
        apertures: [
          { id: 'a0', kind: 'puerta', wallId: 'w2', position: 0.5, widthMm: 900 },
          { id: 'a1', kind: 'ventana', wallId: 'w0', position: 0.5, widthMm: 1200 },
          { id: 'a2', kind: 'hueco', wallId: 'w1', position: 0.5, widthMm: 800 },
        ],
        dimensions: [{ id: 'd0', from: corners[0]!, to: corners[1]!, label: '4.00 m' }],
      },
    ],
  };
}

describe('planoToSvg', () => {
  it('dibuja el arco con centro en la bisagra para los dos lados y extremos', () => {
    const a = { x: 0, y: 0 }, b = { x: 1000, y: 0 };
    expect(doorSymbol(a, b, { x: 0, y: 1 }, DEFAULT_PLAN_SVG_THEME, 'left'))
      .toContain('A 1000 1000 0 0 0 1000 0');
    expect(doorSymbol(a, b, { x: 0, y: -1 }, DEFAULT_PLAN_SVG_THEME, 'left'))
      .toContain('A 1000 1000 0 0 1 1000 0');
    expect(doorSymbol(a, b, { x: 0, y: 1 }, DEFAULT_PLAN_SVG_THEME, 'right'))
      .toContain('A 1000 1000 0 0 1 0 0');
    expect(doorSymbol(a, b, { x: 0, y: -1 }, DEFAULT_PLAN_SVG_THEME, 'right'))
      .toContain('A 1000 1000 0 0 0 0 0');
  });
  it('produce un SVG con viewBox que envuelve el plano más el margen adaptativo', () => {
    const svg = planoToSvg(room());
    // Plano de 4000×3000 mm (bbox 4120 con grosor de muro). El margen escala con
    // el tamaño del plano: factor = clamp(4120/9000, 0.7, 1.8) = 0.7 → 980 mm.
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="-1040 -1040 6080 5080"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('NaN');
  });

  it('alinea una superposición transparente con el marco de la imagen y abre los huecos', () => {
    const svg = planoToSvg(room(), {
      viewBox: { minX: 0, minY: 0, width: 5000, height: 4000 },
      stretchToFrame: true,
      theme: { background: 'transparent', floorFill: 'transparent' },
    });
    expect(svg).toContain('viewBox="0 0 5000 4000"');
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg).toContain('mask="url(#plan-wall-openings)"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="transparent"');
  });

  it('dibuja los cuatro muros como polígonos macizos', () => {
    const svg = planoToSvg(room());
    const pochés = svg.match(/fill="#26221f"\/>/g) ?? [];
    expect(pochés.length).toBe(4);
  });

  it('la puerta abre hueco, tiene hoja y arco con radio igual a su ancho', () => {
    const svg = planoToSvg(room());
    // Arco de barrido: comando A con radio 900 (el ancho de la puerta).
    expect(svg).toMatch(/A 900 900 /);
    // Hueco pintado con el color de fondo sobre el muro.
    expect(svg).toContain('fill="#ffffff"/>');
  });

  it('respeta el lado y la bisagra revisados y numera la puerta en la superposición', () => {
    const plano = room();
    plano.zones[0]!.apertures[0] = { ...plano.zones[0]!.apertures[0]!, swing: 'right', hinge: 'right' };
    const svg = planoToSvg(plano, { showDoorNumbers: true });
    expect(svg).toContain('<line x1="1550" y1="3000" x2="1550" y2="3900"');
    expect(svg).toContain('>1</text>');
  });

  it('la ventana lleva triple línea y el hueco de paso línea discontinua', () => {
    const svg = planoToSvg(room());
    expect(svg).toContain('stroke-dasharray');
    // La línea central del vidrio es fina; las exteriores, de símbolo.
    const lines = svg.match(/<line /g) ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('etiqueta la estancia con nombre y superficie (12,00 m²)', () => {
    const svg = planoToSvg(room());
    expect(svg).toContain('>Salón</text>');
    expect(svg).toContain('12,00 m²');
  });

  it('renderiza la cota con su etiqueta', () => {
    const svg = planoToSvg(room());
    expect(svg).toContain('>4.00 m</text>');
  });

  it('escapa XML en los nombres de estancia', () => {
    const svg = planoToSvg(room('Salón <& "cocina">'));
    expect(svg).toContain('Salón &lt;&amp; &quot;cocina&quot;&gt;');
    expect(svg).not.toContain('<& "');
  });

  it('permite apagar cotas y etiquetas', () => {
    const svg = planoToSvg(room(), { showDimensions: false, showLabels: false });
    expect(svg).not.toContain('<text');
  });

  it('muestra una zona exterior seleccionada incluso sobre el original sin otras etiquetas', () => {
    const plano = room('Portal');
    const svg = planoToSvg(plano, {
      showDimensions: false, showLabels: false, labelZoneIds: ['z0'], showAreas: false,
    });
    expect(svg).toContain('>Portal</text>');
    expect(svg).not.toContain('m²');
  });

  it('con showAreas apagado mantiene el nombre pero oculta los m² (escala estimada)', () => {
    const svg = planoToSvg(room(), { showDimensions: false, showAreas: false });
    expect(svg).toContain('>Salón</text>');
    expect(svg).not.toContain('m²');
    expect(svg).not.toContain('4.00 m');
  });

  it('es determinista y no rompe con un plano vacío', () => {
    expect(planoToSvg(room())).toBe(planoToSvg(room()));
    const empty = planoToSvg({ schemaVersion: 1, zones: [] });
    expect(empty).toContain('<svg');
    expect(empty).not.toContain('NaN');
  });
});
