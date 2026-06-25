'use client';

/**
 * Overlay a pantalla completa con la vista 3D navegable (F6.4). Se abre desde el botón
 * "Ver en 3D" del editor y muestra la escena de la zona activa (el doc que se le pasa).
 * Cierra con el botón X o con Escape.
 *
 * Permite generar una vista estilizada desde el 3D: el usuario elige un ángulo
 * (perspectiva/isométrica/cenital) y un estilo visual; la captura del canvas WebGL se
 * envía a la IA (img2img) como imagen base.
 */
import dynamic from 'next/dynamic';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CanvasDoc, StructKind } from '@/canvas/types';
import type { Estilo } from '@/lib/contracts';
import { ESTILOS } from '@/lib/design-options';
import { useCanvasStore } from '@/canvas/canvas-store';
import { planCenterPx as computePlanCenter, resolvePxPerMeter } from '@/canvas/3d/doc-to-scene';
import { generateViewFrom3D } from '@/app/(app)/projects/[id]/_actions/agent-actions';
import { CATALOG } from '@/canvas/catalog';
import { catalogSizePx, DEFAULT_CEILING_M } from '@/canvas/scale';
import { isLight, defaultLight } from '@/canvas/light';
import { use3DSelection } from './use-3d-selection';
import { ObjectPropertiesPanel } from './object-properties-panel';
import { CatalogPanel3D } from './catalog-panel-3d';

const Plan3DView = dynamic(() => import('./plan-3d-view').then((m) => m.Plan3DView), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-white/70">
      Cargando escena 3D…
    </div>
  ),
});

/** Scroll horizontal de miniaturas de estilo — sin popup. */
function EstiloPicker({
  value,
  onChange,
  disabled,
}: {
  value: Estilo;
  onChange: (v: Estilo) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
      {ESTILOS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={[
            'flex flex-shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-white/10 disabled:opacity-50',
            o.value === value ? 'ring-2 ring-blue-400' : '',
          ].join(' ')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.image}
            alt={o.label}
            className="h-16 w-24 rounded object-cover"
          />
          <span className="w-24 truncate text-center text-[10px] text-white/80">
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Plan3DOverlay({
  doc: initialDoc,
  projectId,
  onClose,
}: {
  doc: CanvasDoc;
  projectId: string;
  onClose: () => void;
}) {
  const searchParams = useSearchParams();
  const zoneId = searchParams.get('zona');
  const [estilo, setEstilo] = useState<Estilo>(ESTILOS[0]!.value);
  const [styleBarOpen, setStyleBarOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const storeDoc = useCanvasStore((s) => s.doc);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const addObject = useCanvasStore((s) => s.addObject);
  const removeObject = useCanvasStore((s) => s.removeObject);
  const doc = storeDoc.objects.length ? storeDoc : initialDoc;
  const [wallMenu, setWallMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const { selectedId, select, clear, mode, setMode } = use3DSelection();
  const selectedObj = selectedId ? (doc.objects.find((o) => o.id === selectedId) ?? null) : null;
  const [swapId, setSwapId] = useState<string | null>(null);
  // Estado de "elige muro" al añadir puerta o ventana desde el catálogo
  const [pendingOpening, setPendingOpening] = useState<{
    id: string; kind: StructKind; w: number; h: number;
  } | null>(null);

  const sceneCoords = useMemo(
    () => ({ planCenterPx: computePlanCenter(doc.objects), pxPerMeter: resolvePxPerMeter(doc) }),
    [doc],
  );

  const ceilingHeightM = doc.ceilingHeightM ?? DEFAULT_CEILING_M;

  const handleAdd = (kind: StructKind) => {
    const entry = CATALOG.flatMap((c) => c.items).find((i) => i.kind === kind);
    if (!entry) return;
    const { w, h } = catalogSizePx(entry, { pxPerMeter: sceneCoords.pxPerMeter });
    if (swapId) {
      const existing = doc.objects.find((o) => o.id === swapId);
      if (existing) {
        removeObject(swapId);
        addObject({
          ...existing,
          kind, width: w, height: h,
          ...(isLight(kind) ? { light: existing.light ?? defaultLight() } : { light: undefined }),
        });
        select(swapId);
      }
      setSwapId(null);
      return;
    }
    const id = `obj-${crypto.randomUUID()}`;
    const isOpening = kind === 'window' || kind === 'door';
    if (isOpening) {
      // Entrar en modo "elige muro" para que el usuario haga clic en el muro destino
      setPendingOpening({ id, kind, w, h });
      return;
    }
    const [cx, cy] = sceneCoords.planCenterPx;
    addObject({
      id, kind,
      x: cx - w / 2, y: cy - h / 2,
      width: w, height: h, rotation: 0,
      ...(isLight(kind) ? { light: defaultLight() } : {}),
    });
    select(id);
    setMode('translate');
  };

  const onPickWallForOpening = (wallId: string) => {
    if (!pendingOpening) return;
    const wall = doc.objects.find((o) => o.id === wallId && o.kind === 'wall');
    if (!wall) return;
    const { id, kind, w, h } = pendingOpening;
    addObject({
      id, kind,
      x: wall.x + wall.width / 2 - w / 2,
      y: wall.y + wall.height / 2 - h / 2,
      width: w, height: h,
      rotation: wall.rotation ?? 0,
    });
    select(id);
    setMode('translate');
    setPendingOpening(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingOpening) { setPendingOpening(null); e.stopPropagation(); return; }
      if (mode !== 'none') { setMode('none'); e.stopPropagation(); }
      else onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, setMode, onClose, pendingOpening]);

  const onPickWall = (sourceId: string, x: number, y: number) => setWallMenu({ id: sourceId, x, y });
  const paintWall = (color: string) => { if (wallMenu) updateObject(wallMenu.id, { color }); };

  const onGenerateView = (dataUrl: string) => {
    setNotice(null);
    setResultUrl(null);
    startTransition(async () => {
      try {
        const outcome = await generateViewFrom3D(projectId, dataUrl, estilo, '16:9', zoneId);
        const url = outcome.deliverables?.find((d) => d.type === 'render3d')?.payload;
        const assetUrl = url && 'assetUrl' in url ? url.assetUrl : null;
        if (assetUrl) setResultUrl(assetUrl);
        else setNotice('Vista generada. Mírala en la pestaña «Diseños».');
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'No se pudo generar la vista.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 select-none bg-neutral-900">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista 3D"
        className="absolute right-4 top-4 z-10 rounded-full bg-neutral-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg ring-1 ring-white/20 hover:bg-neutral-800"
      >
        ✕ Cerrar
      </button>

      <CatalogPanel3D onAdd={handleAdd} swapMode={swapId !== null} />

      {swapId ? (
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-blue-600/90 px-4 py-2 text-sm text-white shadow-lg">
          <span>Selecciona un tipo para reemplazar</span>
          <button
            type="button"
            onClick={() => setSwapId(null)}
            aria-label="Cancelar intercambio"
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : null}

      {pendingOpening ? (
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-cyan-600/90 px-4 py-2 text-sm text-white shadow-lg">
          <span>
            Toca el muro donde colocar la {pendingOpening.kind === 'door' ? 'puerta' : 'ventana'}
          </span>
          <button
            type="button"
            onClick={() => setPendingOpening(null)}
            aria-label="Cancelar"
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Selector de estilo — colapsado por defecto */}
      {styleBarOpen ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 flex min-w-0 items-center gap-2 overflow-hidden rounded-xl bg-black/80 px-3 py-2">
          <span className="flex-shrink-0 text-xs text-white/60">Estilo:</span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <EstiloPicker value={estilo} onChange={setEstilo} disabled={pending} />
          </div>
          {pending && <span className="flex-shrink-0 text-xs text-white/70">Generando…</span>}
          {notice && <span className="flex-shrink-0 text-xs text-green-300">{notice}</span>}
          <button
            type="button"
            onClick={() => setStyleBarOpen(false)}
            aria-label="Cerrar selector de estilo"
            className="flex-shrink-0 text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStyleBarOpen(true)}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs text-white/60 hover:bg-black/85 hover:text-white"
        >
          🎨 Estilo de vista
        </button>
      )}

      {resultUrl ? (
        <div className="absolute bottom-16 left-4 z-10 w-72 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Vista estilizada generada" className="w-full object-cover" />
          <div className="flex items-center justify-between bg-black/80 px-3 py-2">
            <span className="text-xs text-green-300">Vista generada</span>
            <button
              type="button"
              onClick={() => setResultUrl(null)}
              aria-label="Cerrar resultado"
              className="text-xs text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {wallMenu ? (() => {
        const structObj = doc.objects.find((o) => o.id === wallMenu.id);
        const isHidden = structObj?.hidden ?? false;
        const structLabel = structObj?.kind === 'window' ? 'Ventana' : structObj?.kind === 'door' ? 'Puerta' : 'Pared';
        return (
          <div
            className="absolute z-20 flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/20"
            style={{ left: wallMenu.x, top: wallMenu.y }}
          >
            <span className="font-medium">{structLabel}</span>
            {structObj?.kind === 'wall' && (
              <input
                type="color"
                aria-label="Color de la pared"
                defaultValue={structObj?.color ?? '#b7c3cf'}
                onChange={(e) => paintWall(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                title="Pintar"
              />
            )}
            <button
              type="button"
              onClick={() => updateObject(wallMenu.id, { hidden: !isHidden })}
              className="rounded px-2 py-0.5 hover:bg-white/10"
              title={isHidden ? 'Mostrar' : 'Ocultar'}
            >
              {isHidden ? '👁' : '🚫'}
            </button>
            <button
              type="button"
              onClick={() => setWallMenu(null)}
              aria-label="Cerrar"
              className="text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        );
      })() : null}

      {selectedObj ? (
        <ObjectPropertiesPanel
          obj={selectedObj}
          pxPerMeter={sceneCoords.pxPerMeter}
          scene={sceneCoords}
          ceilingHeightM={ceilingHeightM}
          onChange={(patch) => updateObject(selectedObj.id, patch)}
        />
      ) : null}

      <Plan3DView
        doc={doc}
        onGenerateView={pending ? undefined : onGenerateView}
        onPickWall={pendingOpening ? undefined : onPickWall}
        pickWallForOpening={pendingOpening !== null}
        onPickWallForOpening={onPickWallForOpening}
        selectedId={selectedId}
        onSelect={select}
        onDeselect={clear}
        mode={mode}
        onSetMode={setMode}
        onSwap={(id) => setSwapId(id)}
      />
    </div>
  );
}
