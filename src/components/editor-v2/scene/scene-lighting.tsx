'use client';

/** Sin sesgo, las superficies grandes (techos, suelos) se sombrean a sí mismas en franjas («shadow acne»). */
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.02;

export type SceneLightingPreset = 'daylight' | 'warm' | 'evening';

export const SCENE_LIGHTING_LABELS: Record<SceneLightingPreset, string> = {
  daylight: 'Luz de día',
  warm: 'Atardecer cálido',
  evening: 'Noche ambiental',
};

/**
 * Presentational lighting only: it never changes the canonical building document.
 *
 * Cada preset proyecta sombra con UNA sola luz (la direccional que hace de sol).
 * Cada luz con sombra añade un sampler a todos los materiales iluminados, y
 * sumada a las luminarias (ver `MAX_SHADOW_LIGHTS`) el shader se quedaba sin
 * unidades de textura y el material no compilaba.
 */
export function SceneLighting({ preset, hasLuminaires = false }: { preset: SceneLightingPreset; hasLuminaires?: boolean }) {
  if (preset === 'warm') return <>
    <color attach="background" args={['#f5ede2']} />
    <hemisphereLight args={['#ffe8c1', '#79685a', 1.3]} />
    <directionalLight position={[-8, 7, 5]} intensity={2.1} color="#ffd09b" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={.7} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[8, 4, -6]} intensity={.55} color="#bcd5ff" />
  </>;
  if (preset === 'evening') return <>
    <color attach="background" args={['#18232d']} />
    <hemisphereLight args={['#7699bd', '#101820', .55]} />
    {!hasLuminaires && <>
    <directionalLight position={[4, 9, 3]} intensity={.8} color="#b9d7ff" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={3} shadow-intensity={.65} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <pointLight position={[-4, 4, 2]} intensity={22} distance={18} decay={2} color="#ffc475" />
    <pointLight position={[5, 3, -4]} intensity={14} distance={15} decay={2} color="#ffd7a8" />
    </>}
  </>;
  return <>
    <color attach="background" args={['#edf2ef']} />
    <hemisphereLight args={['#ffffff', '#9ea99f', 1.35]} />
    <directionalLight position={[5, 12, 8]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={.65} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[-8, 5, -4]} intensity={.45} color="#d9e8ff" />
  </>;
}
