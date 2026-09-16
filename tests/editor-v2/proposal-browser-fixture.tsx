/** Banco UI aislado: sin proveedor, servidor de proyectos ni persistencia. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorGenerateDialog } from '@/components/editor-v2/editor-generate-dialog';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { applyNativeDesignProposal, type NativeDesignProposal } from '@/lib/editor-document/native-design-proposal';

const proposal: NativeDesignProposal = { style: 'moderno', summary: 'Fixture de prueba local: acabado madera.', furniture: [],
  materials: { walls: 'polyhaven:wood_floor', floors: 'polyhaven:wood_floor', stairs: 'polyhaven:wood_floor',
    ramps: 'polyhaven:wood_floor', columns: 'polyhaven:wood_floor' } };
const source = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], true);
const store = createEditorStore(source);

function Fixture() {
  const [open, setOpen] = useState(true);
  const [fail, setFail] = useState(false);
  const [result, setResult] = useState('Sin aplicar');
  const [permissions, setPermissions] = useState('Sin petición');
  return <><h1>Prueba aislada de propuesta · Sin IA ni guardado remoto</h1>
    <label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)} />Simular rechazo de aplicación</label>
    <p data-testid="result">{result}</p>
    <p data-testid="permissions">{permissions}</p>
    <button onClick={() => setOpen(true)}>Abrir diálogo de prueba</button>
    {open && <EditorGenerateDialog document={store.getState().document} spaceKind="patio"
      onSpaceKindChange={() => {}} onClose={() => setOpen(false)} onGenerate={async (input) => {
        setPermissions(JSON.stringify(input.options)); return proposal;
      }}
      onRender={async () => { throw new Error('Render desactivado en pruebas'); }}
      onApply={(next, selected) => {
        if (fail) throw new Error('Rechazo de prueba: posición no válida');
        store.getState().apply(applyNativeDesignProposal(store.getState().document, next, selected));
        setResult(`Plano actualizado: ${store.getState().document.floorFinishes?.[0]?.texture}`);
      }} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
