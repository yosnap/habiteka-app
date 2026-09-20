/**
 * Renderer SVG del plano técnico: geometría correcta, simbología presente,
 * textos escapados y salida determinista.
 */
import { describe, expect, it } from 'vitest';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
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
  it('produce un SVG con viewBox que envuelve el plano más el margen adaptativo', () => {
    const svg = planoToSvg(room());
    // Plano de 4000×3000 mm (bbox 4120 con grosor de muro). El margen escala con
    // el tamaño del plano: factor = clamp(4120/9000, 0.7, 1.8) = 0.7 → 980 mm.
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="-1040 -1040 6080 5080"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('NaN');
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
