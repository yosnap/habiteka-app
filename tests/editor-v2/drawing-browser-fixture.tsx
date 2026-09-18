import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { CanvasView } from '@/components/editor-v2/canvas-view';
import { createEditorStore, type EditorTool } from '@/canvas/editor-v2/store';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { NumberField } from '@/components/editor-v2/property-number-field';
import { FloorFinishPanel } from '@/components/editor-v2/floor-finish-panel';
import { ElementDetailsPanel } from '@/components/editor-v2/element-details-panel';
import { Inspector } from '@/components/editor-v2/inspector';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { OUTDOOR_CATALOG } from '@/lib/editor-document/outdoor-catalog';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

const store = createEditorStore(emptyEditorDocument());
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function Fixture() {
  const [numericValue, setNumericValue] = useState(1);

  const [result, setResult] = useState('Preparado');
  async function run() {
    const results: string[] = [];
    try {
      for (const tool of ['wall', 'guard-wall', 'valla-madera', 'cerca-metal', 'seto', 'patio', 'rectangle', 'measure'] as EditorTool[]) {
        store.getState().restore(emptyEditorDocument());
        store.getState().setTool(tool); await frame();
        const canvas = document.querySelector('.konvajs-content') as HTMLElement;
        if (!getComputedStyle(canvas).cursor.includes('svg')) throw new Error(`${tool}: falta lápiz`);
        const send = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
          buttons: type === 'pointerup' ? 0 : 1, clientX: canvas.getBoundingClientRect().left + x, clientY: canvas.getBoundingClientRect().top + y,
        }));
        const chained = !['rectangle', 'measure'].includes(tool);
        if (chained) {
          for (const [x, y] of [[150, 150], [430, 150], [430, 370], [150, 370], [150, 150]]) {
            send('pointermove', x!, y!); await frame();
            send('pointerdown', x!, y!); send('pointerup', x!, y!); await frame();
          }
        } else {
          send('pointerdown', 150, 150); await frame();
          send('pointermove', 430, 370); await frame();
          send('pointerup', 430, 370); await frame();
        }
        const state = store.getState();
        if (state.tool !== 'select') throw new Error(`${tool}: sigue en dibujo (${state.error ?? 'sin error'}); paredes=${JSON.stringify(state.document.vertices)}`);
        if (getComputedStyle(canvas).cursor.includes('svg')) throw new Error(`${tool}: lápiz sigue activo`);
        const boundary = ['valla-madera', 'cerca-metal', 'seto'].includes(tool);
        const count = boundary ? state.document.furniture.length : tool === 'measure' ? state.document.dimensions.length : state.document.walls.length;
        if (count !== (tool === 'measure' ? 1 : 4)) throw new Error(`${tool}: geometría incorrecta (${count})`);
        if (chained) {
          store.getState().restore(emptyEditorDocument()); store.getState().setTool(tool); await frame();
          send('pointerdown', 150, 150); send('pointerup', 150, 150); await frame();
          if (store.getState().document.walls.length || store.getState().document.furniture.length) throw new Error(`${tool}: primer clic crea geometría`);
          send('pointermove', 430, 150); await frame();
          send('pointerdown', 430, 150); send('pointerup', 430, 150); await frame();
          if (store.getState().tool !== tool) throw new Error(`${tool}: no continúa desde el extremo`);
          document.querySelector('[aria-label="Lienzo del plano"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frame();
          if (store.getState().tool !== 'select') throw new Error(`${tool}: Escape no termina`);
          const remaining = boundary ? store.getState().document.furniture.length : store.getState().document.walls.length;
          if (remaining !== 1) throw new Error(`${tool}: Escape perdió el tramo`);
        }
        results.push(`${tool}: lápiz, geometría, cierre y selección${chained ? ', continuación y Escape' : ''} OK`);
      }
      const patio = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 4000, y: 3000 });
      store.getState().restore(patio); await frame();
      const canvas = document.querySelector('.konvajs-content') as HTMLElement;
      const bounds = canvas.getBoundingClientRect();
      const mouse = (type: string, x: number, y: number) => canvas.dispatchEvent(new MouseEvent(type, {
        bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, clientX: bounds.left + x, clientY: bounds.top + y,
      }));
      mouse('mousedown', 180, 180); mouse('mouseup', 180, 180); await frame();
      if (!document.querySelector('[aria-label="Acciones de patio / terraza"]')) throw new Error('Patio: no aparece menú');
      if (document.querySelector('[aria-label="Cerrar acciones"]')) throw new Error('Sigue apareciendo X');
      mouse('mousedown', 180, 180); mouse('mousemove', 220, 200); await frame();
      mouse('mousemove', 260, 220); mouse('mouseup', 260, 220); await frame();
      if (store.getState().document.vertices[0]!.x <= patio.vertices[0]!.x) throw new Error('Patio: no se mueve');
      (document.querySelector('[aria-label="Textura del suelo"]') as HTMLButtonElement).click(); await frame();
      if (!document.querySelector('[aria-label="Acabados del suelo"]')) throw new Error('No abre texturas');
      results.push('patio: clic muestra menú sin X, arrastre mueve y texturas abren OK');
      const field = document.querySelector('[aria-label="Prueba numérica"]') as HTMLInputElement;
      field.focus(); await frame();
      for (let i = 0; i < 2; i++) { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await frame(); }
      if (document.activeElement !== field || Number(field.value) !== 1.2) throw new Error(`Stepper perdió foco o valor: ${field.value}`);
      (document.querySelector('[aria-label="Disminuir Prueba numérica"]') as HTMLButtonElement).click(); await frame();
      if (Number(field.value) !== 1.1) throw new Error('Stepper no responde al botón');
      results.push('input: flechas repetidas conservan foco y botones incrementan/reducen OK');
      const alignmentDoc = emptyEditorDocument();
      alignmentDoc.labels.push({ id: 'moving', text: 'Mover', x: 1000, y: 1000 }, { id: 'target', text: 'Eje', x: 3000, y: 2000 });
      store.getState().restore(alignmentDoc); await frame();
      mouse('mousedown', 164, 165); mouse('mousemove', 210, 205); await frame();
      mouse('mousemove', 322, 245); await frame();
      if (!store.getState().magneticGuides.length) throw new Error('No aparecen guías durante el arrastre');
      mouse('mouseup', 322, 245); await frame();
      if (store.getState().document.labels[0]!.x !== 3000) throw new Error('No se aplicó el imán al texto');
      results.push('guías: aparecen durante arrastre y el texto queda alineado exactamente OK');
      const poolDoc = addFurniture(emptyEditorDocument(), OUTDOOR_CATALOG.find((item) => item.kind === 'piscina')!, { x: 0, y: 0 });
      store.getState().restore(poolDoc); store.getState().select([poolDoc.furniture[0]!.id]);
      store.getState().setDetailAnchor({ x: window.innerWidth - 40, y: window.innerHeight - 40 });
      store.getState().setDetailPanel('paint'); await frame();
      const paintPanel = document.querySelector('[aria-label="Pintar elemento"]') as HTMLElement;
      const rect = paintPanel.getBoundingClientRect();
      if (rect.right > window.innerWidth || rect.bottom > window.innerHeight || rect.left < 0 || rect.top < 0) throw new Error('Panel fuera del viewport');
      if (rect.bottom < window.innerHeight - 200) throw new Error('Panel demasiado lejos de selección');
      if (!paintPanel.textContent?.includes('Piscina elevada')) throw new Error('Nombre incorrecto en acabados');
      if (!document.querySelector('[aria-label="Propiedades de selección"]')?.textContent?.includes('Piscina elevada')) throw new Error('Nombre incorrecto en inspector');
      results.push('piscina: nombre real en inspector y panel de pintura próximo, dentro del viewport OK');
      setResult(results.join('\n'));
    } catch (error) { setResult(`${results.join('\n')}\nERROR: ${error}`); }
  }
  return <><NumberField label="Prueba numérica" value={numericValue} step={.1} change={setNumericValue} /><button onClick={run}>Probar dibujo</button><pre role="status">{result}</pre>
    <div style={{ height: 650, position: 'relative', display: 'flex' }}><CanvasView store={store} onCenter={() => {}} /><FloorFinishPanel store={store} /><ElementDetailsPanel store={store} /></div><Inspector store={store} /></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
