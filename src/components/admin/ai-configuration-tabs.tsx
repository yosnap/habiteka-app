'use client';

import { useState, type ReactNode } from 'react';

export function AiConfigurationTabs({ providerSettings, modelMapping }: { providerSettings: ReactNode; modelMapping: ReactNode }) {
  const [tab, setTab] = useState<'providers' | 'models'>('providers');
  return <div className="flex flex-col gap-4">
    <div className="flex w-fit gap-1 rounded-control border border-line bg-muted/30 p-1" role="tablist" aria-label="Configuración de IA">
      <button type="button" role="tab" aria-selected={tab === 'providers'} className={`rounded-control px-3 py-1.5 text-sm ${tab === 'providers' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => setTab('providers')}>Configuración IA</button>
      <button type="button" role="tab" aria-selected={tab === 'models'} className={`rounded-control px-3 py-1.5 text-sm ${tab === 'models' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => setTab('models')}>Modelos por uso</button>
    </div>
    <div role="tabpanel" hidden={tab !== 'providers'}>{providerSettings}</div>
    <div role="tabpanel" hidden={tab !== 'models'}>{modelMapping}</div>
  </div>;
}
