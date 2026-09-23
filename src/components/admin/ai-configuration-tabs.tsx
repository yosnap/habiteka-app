'use client';

import { useState, type ReactNode } from 'react';

type Tab = 'providers' | 'models' | 'quality';

const TABS: { id: Tab; label: string }[] = [
  { id: 'providers', label: 'Configuración IA' },
  { id: 'models', label: 'Modelos por uso' },
  { id: 'quality', label: 'Jev (TypeSafe)' },
];

export function AiConfigurationTabs({ providerSettings, modelMapping, qualitySettings }: { providerSettings: ReactNode; modelMapping: ReactNode; qualitySettings: ReactNode }) {
  const [tab, setTab] = useState<Tab>('providers');
  return <div className="flex flex-col gap-4">
    <div className="flex w-fit gap-1 rounded-control border border-line bg-muted/30 p-1" role="tablist" aria-label="Configuración de IA">
      {TABS.map(({ id, label }) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={`rounded-control px-3 py-1.5 text-sm ${tab === id ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => setTab(id)}>{label}</button>
      ))}
    </div>
    <div role="tabpanel" hidden={tab !== 'providers'}>{providerSettings}</div>
    <div role="tabpanel" hidden={tab !== 'models'}>{modelMapping}</div>
    <div role="tabpanel" hidden={tab !== 'quality'}>{qualitySettings}</div>
  </div>;
}
