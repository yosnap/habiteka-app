'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { canFitOnHost } from '@/lib/editor-document/object-host-rest';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { elementName } from '@/lib/editor-document/element-classification';

export function ScenePlanContextMenu({ document, item, x, y, onRotate, onHost, onClose }: {
  document: EditorDocument; item: Furniture; x: number; y: number;
  onRotate: (degrees: number) => void; onHost: (hostId: string) => void; onClose: () => void;
}) {
  const firstButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstButton.current?.focus(); }, [item.id]);
  const hosts = useMemo(() => planObjects(document).filter((host) => canFitOnHost(item, host))
    .sort((a, b) => {
      const center = objectCenter(item), first = objectCenter(a), second = objectCenter(b);
      return Math.hypot(first.x - center.x, first.y - center.y) - Math.hypot(second.x - center.x, second.y - center.y);
    }), [document, item]);
  return <div data-plan-menu role="dialog" aria-label={`Opciones de ${elementName(item)}`}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    onPointerDown={(event) => event.stopPropagation()}
    style={{ position: 'absolute', zIndex: 12, left: x, top: y, width: 246, maxHeight: 350, overflowY: 'auto',
      padding: 10, borderRadius: 11, background: '#fffdfa', border: '1px solid #cad7cf',
      boxShadow: '0 12px 35px rgba(20,44,37,.2)', color: '#243a31', fontSize: 13 }}>
    <strong style={{ display: 'block', padding: '3px 5px 9px' }}>{elementName(item)}</strong>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button ref={firstButton} type="button" onClick={() => onRotate(-15)}>↶ 15°</button>
      <button type="button" onClick={() => onRotate(15)}>↷ 15°</button>
      <button type="button" onClick={() => onRotate(90)}>↷ 90°</button>
    </div>
    {hosts.length > 0 && <div style={{ borderTop: '1px solid #e2e8e2', marginTop: 10, paddingTop: 9 }}>
      <strong style={{ display: 'block', marginBottom: 5 }}>Colocar encima de…</strong>
      {hosts.map((host) => <button key={host.id} type="button" onClick={() => onHost(host.id)}
        style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 4, whiteSpace: 'normal' }}>
        {elementName(host)}
      </button>)}
    </div>}
    <button type="button" aria-label="Cerrar menú" onClick={onClose}
      style={{ marginTop: 9, fontSize: 11 }}>Cerrar</button>
  </div>;
}
