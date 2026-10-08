'use client';

import type { ReactNode } from 'react';
import { CheckToggle } from '@/components/ui/check-toggle';
import { ModernSelect } from '@/components/ui/modern-select';
import { surfaceMaterial, SURFACE_MATERIALS } from '@/lib/editor-document/surface-materials';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import type { designMaterialPalette } from '@/lib/editor-document/design-material-palette';
import type { NativeDesignProposal, NativeDesignSelection } from '@/lib/editor-document/native-design-proposal';
import { KITCHEN_SLOT_DEFAULTS } from '@/lib/editor-document/kitchen-run-types';

/** Revisión de una propuesta de «Diseñar el plano» antes de aplicarla: acabados, fachada, estancias y objetos. */
export function ProposalPreview({
  proposal,
  selection,
  palette,
  onChange,
  onMaterialChange,
  onRoomFinishChange,
}: {
  proposal: NativeDesignProposal;
  selection: NativeDesignSelection;
  palette?: ReturnType<typeof designMaterialPalette>;
  onChange: (selection: NativeDesignSelection) => void;
  onMaterialChange: (key: Exclude<keyof NativeDesignSelection, 'furniture' | 'kitchens' | 'fixedFinishes'> | 'exteriorWalls', value: string) => void;
  onRoomFinishChange: (roomId: string, key: 'floor' | 'walls', value: string) => void;
}) {
  const materialLabel = (id: string) => surfaceMaterial(id)?.label ?? id;
  const materialChoices = (key: Exclude<keyof NativeDesignSelection, 'furniture' | 'kitchens' | 'fixedFinishes'>) => {
    const ids = key === 'floors' ? ['none', 'wood', 'tile'] : [];
    return [...new Set([...ids, ...(palette?.[key] ?? []), ...SURFACE_MATERIALS.map((material) => material.id)])];
  };
  const toggle = (key: Exclude<keyof NativeDesignSelection, 'furniture' | 'kitchens' | 'fixedFinishes'>) =>
    onChange({ ...selection, [key]: !selection[key] });
  const toggleFurniture = (index: number) =>
    onChange({
      ...selection,
      furniture: selection.furniture.includes(index)
        ? selection.furniture.filter((value) => value !== index)
        : [...selection.furniture, index],
    });
  const toggleKitchen = (index: number) => {
    const kitchens = selection.kitchens ?? [];
    onChange({ ...selection, kitchens: kitchens.includes(index) ? kitchens.filter((value) => value !== index) : [...kitchens, index] });
  };
  return (
    <div className="text-ink mt-5 space-y-3 text-sm">
      <p className="bg-canvas rounded-control border border-line p-3">{proposal.summary}</p>
      {proposal.sketchMissing?.length ? <p className="rounded-control border border-amber-300 bg-amber-50 p-3 text-amber-900">
        En tu boceto hay objetos que aún no están en el catálogo y no se han colocado: {proposal.sketchMissing.join(', ')}.
      </p> : null}
      {proposal.fixedFinishes?.map((finish, index) => <CheckToggle key={finish.id}
        checked={selection.fixedFinishes?.includes(index) ?? false} onChange={(checked) => onChange({ ...selection,
          fixedFinishes: checked ? [...(selection.fixedFinishes ?? []), index] : selection.fixedFinishes?.filter((value) => value !== index) })} label={<span>
        {finish.label ?? `Fijo ${index + 1}`}: {finish.color}{finish.baseMaterialId ? ` · frentes ${materialLabel(finish.baseMaterialId)}` : ''}
        {finish.worktopMaterialId ? ` · encimera ${materialLabel(finish.worktopMaterialId)}` : ''}
        {finish.worktopColor ? ` · encimera ${finish.worktopColor}` : ''}
        {finish.uppersColor ? ` · altos ${finish.uppersColor}` : ''}{finish.plinthColor ? ` · zócalo ${finish.plinthColor}` : ''}
      </span>} />)}
      <p className="text-ink-soft text-xs">Se aplicará a {proposal.scope?.kind === 'house' ? 'solo la casa de esta planta'
        : proposal.scope?.kind === 'interior' ? 'las estancias interiores'
        : proposal.scope?.kind === 'exterior' ? 'las zonas exteriores'
        : proposal.scope?.kind === 'rooms' ? `${proposal.scope.roomIds.length} estancia(s) y ${proposal.scope.structureIds?.length ?? 0} pieza(s) elegida(s)`
          : proposal.scope?.kind === 'zone' ? 'la zona dibujada' : 'toda esta planta'}.
        Los demás acabados se conservarán.</p>
      {proposal.scope?.kind === 'zone' && <p className="text-ink-soft text-xs">El pavimento queda recortado al contorno. Solo cambia un muro si cabe completo dentro de la zona; los muros que cruzan a otra zona conservan su material.</p>}
      <div className="grid grid-cols-2 gap-2 rounded-control border border-line p-3 text-xs">
        {(['walls', 'floors', 'stairs', 'ramps', 'columns'] as const).map((key) => (
          <div key={key} className={`space-y-1 ${selection[key] ? '' : 'opacity-50'}`}>
            <CheckToggle className="font-medium" checked={selection[key]} onChange={() => toggle(key)} label={key === 'walls'
              ? 'Muros'
              : key === 'floors'
                ? 'Suelos'
                : key === 'stairs'
                  ? 'Escaleras'
                  : key === 'ramps'
                  ? 'Rampas'
                    : 'Columnas'} />
            <ModernSelect compact value={proposal.materials[key]} disabled={!selection[key]}
              aria-label={`Material de ${key === 'walls' ? 'muros' : key === 'floors' ? 'suelos' : key === 'stairs' ? 'escaleras' : key === 'ramps' ? 'rampas' : 'columnas'}`}
              onChange={(event) => onMaterialChange(key, event.target.value)}>
              {materialChoices(key).map((id) => <option key={id} value={id}>{materialLabel(id)}{palette?.[key].includes(id) ? ' · usado' : ''}</option>)}
            </ModernSelect>
          </div>
        ))}
        {proposal.materials.exteriorWalls && <div className={`col-span-2 space-y-1 ${selection.walls ? '' : 'opacity-50'}`}>
          <p className="font-medium">Fachada (caras exteriores de los muros)</p>
          <ModernSelect compact value={proposal.materials.exteriorWalls} disabled={!selection.walls} aria-label="Material de fachada"
            onChange={(event) => onMaterialChange('exteriorWalls', event.target.value)}>
            {materialChoices('walls').map((id) => <option key={id} value={id}>{materialLabel(id)}</option>)}
          </ModernSelect>
        </div>}
        {proposal.roomFinishes?.length ? <div className="col-span-2 space-y-2">
          <p className="font-medium">Por estancia</p>
          {proposal.roomFinishes.map((finish) => <div key={finish.roomId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <span className="truncate">{finish.name}</span>
            <ModernSelect compact value={finish.floor} disabled={!selection.floors} aria-label={`Suelo de ${finish.name}`}
              onChange={(event) => onRoomFinishChange(finish.roomId, 'floor', event.target.value)}>
              {materialChoices('floors').map((id) => <option key={id} value={id}>{materialLabel(id)}</option>)}
            </ModernSelect>
            <ModernSelect compact value={finish.walls} disabled={!selection.walls} aria-label={`Paredes de ${finish.name}`}
              onChange={(event) => onRoomFinishChange(finish.roomId, 'walls', event.target.value)}>
              {materialChoices('walls').map((id) => <option key={id} value={id}>{materialLabel(id)}</option>)}
            </ModernSelect>
          </div>)}
          <p className="text-ink-soft">Suelo y paredes de cada estancia. «Muros» y «Suelos» activan o desactivan estos cambios; sus materiales de arriba solo se usan en estancias sin acabado propio.</p>
        </div> : null}
        {proposal.scope?.kind !== 'zone' && proposal.materials.slabUndersides && <p className="text-ink-soft col-span-2 text-xs">
          Con suelos: canto y cara inferior de los forjados elevados · {materialLabel(proposal.materials.slabUndersides)}
          {palette && !palette.slabUndersides.includes(proposal.materials.slabUndersides)
            ? <span className="text-amber-700"> · nuevo para el inmueble</span> : null}
        </p>}
        {proposal.materials.stairBodies && <p className="text-ink-soft col-span-2 text-xs">
          Con escaleras: contrahuellas, laterales y cara inferior · {materialLabel(proposal.materials.stairBodies)}
          {palette && !palette.stairBodies.includes(proposal.materials.stairBodies)
            ? <span className="text-amber-700"> · nuevo para el inmueble</span> : null}
        </p>}
        {proposal.materials.rampBodies && <p className="text-ink-soft col-span-2 text-xs">
          Con rampas: laterales y cara inferior · {materialLabel(proposal.materials.rampBodies)}
          {palette && !palette.rampBodies.includes(proposal.materials.rampBodies)
            ? <span className="text-amber-700"> · nuevo para el inmueble</span> : null}
        </p>}
        {proposal.materials.landingBodies && <p className="text-ink-soft col-span-2 text-xs">
          Con rampas: canto y cara inferior de los descansillos · {materialLabel(proposal.materials.landingBodies)}
          {palette && !palette.landingBodies.includes(proposal.materials.landingBodies)
            ? <span className="text-amber-700"> · nuevo para el inmueble</span> : null}
        </p>}
      </div>
      <div>
        <p className="font-medium">Mobiliario e iluminación</p>
        {proposal.furniture.length || proposal.kitchens?.length ? (
          <ul className="text-ink-soft mt-1 space-y-1">
            {proposal.kitchens?.map((kitchen, index) => (
              <li key={`cocina-${index}`}>
                <Choice checked={selection.kitchens?.includes(index) ?? false} onChange={() => toggleKitchen(index)}>
                  Cocina de {(kitchen.lengthMm / 1000).toFixed(1).replace('.', ',')} m
                  {kitchen.appliances.length ? ` (${kitchen.appliances.map((kind) => KITCHEN_SLOT_DEFAULTS[kind].label.toLowerCase()).join(', ')})` : ''}
                  {kitchen.reason ? ` · ${kitchen.reason}` : ''}
                </Choice>
              </li>
            ))}
            {proposal.furniture.map((item, index) => (
              <li key={`${item.catalogId}-${index}`}>
                <Choice
                  checked={selection.furniture.includes(index)}
                  onChange={() => toggleFurniture(index)}
                >
                  {getFurnitureCatalogEntry(item.catalogId)?.label ?? item.catalogId}
                  {item.reason ? ` · ${item.reason}` : ''}
                </Choice>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft mt-1">
            La propuesta se concentra en acabados; no añade objetos al plano.
          </p>
        )}
      </div>
      <p className="text-ink-soft text-xs">
        Al aplicar solo se cambian acabados y se añaden los objetos listados. La geometría se
        conserva intacta.
      </p>
    </div>
  );
}
function Choice({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <CheckToggle className={checked ? '' : 'opacity-50'} checked={checked} onChange={onChange} label={children} />
  );
}
