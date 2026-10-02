import type { NativeVideoMode } from './native-video';
import type { ApprovedLightingPreset } from './approved-design';
import { LIGHTING_LABELS } from '@/lib/lighting-preset';
import { VIDEO_DIMENSION_MODES, videoDimensionMode, type VideoPresentationOptions } from './video-presentation';
import { constructionTiming } from './construction-timing';

/** Guion portable. No ejecuta IA ni convierte instrucciones libres en cambios del modelo 3D. */
export function videoGenerationPrompt(mode: NativeVideoMode, lighting: ApprovedLightingPreset, options: VideoPresentationOptions) {
  const timing = constructionTiming(options);
  const story = mode === 'construction' || mode === 'showcase'
    ? 'Cámara fija durante la obra. Suelos primero. Cada muro crece desde su base hasta su altura completa antes de empezar el siguiente; nunca aparecen todos juntos. Después colocar huecos, cubierta y los muebles de las referencias. Solo entonces empezar un vuelo suave alrededor del edificio.'
    : mode === 'promotion'
      ? 'Presentación arquitectónica con vuelo exterior suave. Mostrar el diseño terminado y su entorno real, sin cambiar el edificio durante el giro.'
      : 'Recorrido continuo a altura de ojos por las estancias. Movimiento suave, sin atravesar paredes, muebles ni puertas cerradas. Usar los interiores generados como referencias de mobiliario y materiales.';
  const measure = VIDEO_DIMENSION_MODES.find(item => item.value === videoDimensionMode(options))!;
  return [
    'Película arquitectónica fotorrealista basada en el diseño aprobado y sus imágenes de referencia.',
    `Ámbito: ${options.contentScope === 'all' ? 'todo el plano seleccionado' : 'solo la casa; no añadir jardín, piscina, terreno modelado ni elementos fuera del ámbito'}. Si hay ortofoto confirmada, conservar su geografía y el encaje aprobado.`,
    `Luz: ${LIGHTING_LABELS[lighting]}; mantenerla coherente en todos los planos.`,
    'Conservar exactamente distribución, huecos, fachada, tejado, aleros y pérgolas incluidas en el ámbito. Mantener los mismos muebles, colores y materiales de los diseños generados. No inventar objetos ni reconstruir el mobiliario antiguo del editor.',
    story,
    ...(mode === 'construction' || mode === 'showcase' ? [
      `Duración de la construcción: ${timing.durationMs / 1000} segundos${mode === 'showcase' ? ', más la visita posterior' : ' en total'}. Ritmo acelerado sin pausas: vacío 0–${timing.starts[0]! / 1000} s; suelos hasta ${timing.ends[0]! / 1000} s; todos los muros, uno a uno, de ${timing.starts[1]! / 1000} a ${timing.ends[1]! / 1000} s (3 segundos en conjunto); huecos y tejado hasta ${timing.ends[2]! / 1000} s; muebles hasta ${timing.ends[3]! / 1000} s; vuelo final hasta ${timing.durationMs / 1000} s. No alargar la construcción para mostrar cada muro.`,
    ] : []),
    ...(mode === 'showcase' ? ['Después del vuelo, enlazar con una visita a altura de ojos siguiendo las referencias interiores; conservar identidad entre exterior e interior.'] : []),
    `Sonido: ${options.soundEffects ? 'FX discretos de obra sincronizados con cada muro y cada etapa; ambiente coherente, sin música ni voz salvo indicación explícita' : 'sin efectos, música ni voz'}.`,
    `Cotas previstas para composición: ${measure.label}. ${measure.description} ${options.dimensionOcclusion !== false ? 'Ocultar cotas detrás del edificio cuando haya oclusión.' : 'Mantener las cotas visibles por delante.'} No inventar ni dibujar cifras en el clip generado; los valores exactos se obtienen del plano.`,
    'Evitar deformaciones, objetos que desaparezcan, saltos de cámara, texturas que parpadeen y pérdida de elementos de la casa. Rechazar un clip que cambie la identidad del diseño.',
    ...(options.prompt?.trim() ? [`Indicaciones adicionales del usuario:\n${options.prompt.trim()}`] : []),
  ].join('\n\n');
}
