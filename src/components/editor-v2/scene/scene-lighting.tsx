'use client';

export type SceneLightingPreset = 'daylight' | 'warm' | 'evening';

export const SCENE_LIGHTING_LABELS: Record<SceneLightingPreset, string> = {
  daylight: 'Luz de día',
  warm: 'Atardecer cálido',
  evening: 'Noche ambiental',
};

/** Presentational lighting only: it never changes the canonical building document. */
export function SceneLighting({ preset }: { preset: SceneLightingPreset }) {
  if (preset === 'warm') return <>
    <color attach="background" args={['#f5ede2']} />
    <hemisphereLight args={['#ffe8c1', '#79685a', 1.3]} />
    <directionalLight position={[-8, 7, 5]} intensity={2.4} color="#ffd09b" castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[8, 4, -6]} intensity={.55} color="#bcd5ff" />
  </>;
  if (preset === 'evening') return <>
    <color attach="background" args={['#18232d']} />
    <hemisphereLight args={['#7699bd', '#101820', .55]} />
    <directionalLight position={[4, 9, 3]} intensity={.8} color="#b9d7ff" castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <pointLight position={[-4, 4, 2]} intensity={22} distance={18} decay={2} color="#ffc475" castShadow />
    <pointLight position={[5, 3, -4]} intensity={14} distance={15} decay={2} color="#ffd7a8" />
  </>;
  return <>
    <color attach="background" args={['#edf2ef']} />
    <hemisphereLight args={['#ffffff', '#9ea99f', 1.35]} />
    <directionalLight position={[5, 12, 8]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[-8, 5, -4]} intensity={.45} color="#d9e8ff" />
  </>;
}
