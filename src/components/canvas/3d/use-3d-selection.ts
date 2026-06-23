import { useState } from 'react';

export type SelectionMode = 'none' | 'translate' | 'rotate';

export interface Selection3D {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
  mode: SelectionMode;
  setMode: (m: SelectionMode) => void;
}

export function use3DSelection(): Selection3D {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setModeState] = useState<SelectionMode>('none');

  return {
    selectedId,
    select(id) {
      setSelectedId(id);
      setModeState('none');
    },
    clear() {
      setSelectedId(null);
      setModeState('none');
    },
    mode,
    setMode: setModeState,
  };
}
