'use client';

/** Sin sesgo, las superficies grandes (techos, suelos) se sombrean a sí mismas en franjas («shadow acne»). */
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.02;

export type SceneLightingPreset = import('@/lib/lighting-preset').LightingPreset;

export const SCENE_LIGHTING_LABELS: Record<SceneLightingPreset, string> = {
  daylight: 'Luz de día',
  afternoon: 'Luz de tarde',
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
  if (preset === 'afternoon') return <>
    <color attach="background" args={['#eeeae1']} />
    <hemisphereLight args={['#fff3df', '#969080', .65]} />
    <directionalLight position={[-10, 6, 7]} intensity={1.25} color="#fff0da" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={.75} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[8, 4, -6]} intensity={.2} color="#d9e8ff" />
  </>;
  if (preset === 'warm') return <>
    <color attach="background" args={['#eee7dd']} />
    <hemisphereLight args={['#ffe8c1', '#79685a', .9]} />
    <directionalLight position={[-8, 7, 5]} intensity={1.5} color="#ffd09b" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={.7} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[8, 4, -6]} intensity={.25} color="#bcd5ff" />
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
    <color attach="background" args={['#eeede8']} />
    <hemisphereLight args={['#ffffff', '#a9aaa0', .55]} />
    <directionalLight position={[5, 12, 8]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4} shadow-intensity={.8} shadow-bias={SHADOW_BIAS} shadow-normalBias={SHADOW_NORMAL_BIAS}
      shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
    <directionalLight position={[-8, 5, -4]} intensity={.16} color="#d9e8ff" />
  </>;
}
