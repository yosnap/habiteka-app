import type { ModelAction } from '@/generated/prisma/enums';

/**
 * Guía de cada uso de IA para quien elige sus modelos: qué hace y qué conviene buscar en un modelo. El modelo concreto
 * que se recomienda no está aquí: es el que la administración pone en «Modelos recomendados».
 */
export interface ModelUseGuide { action: ModelAction; label: string; purpose: string; advice: string }

export const MODEL_USE_GUIDE: readonly ModelUseGuide[] = [
  { action: 'chat', label: 'Asistente', purpose: 'Conversación del proyecto, preguntas y propuestas de diseño.',
    advice: 'Un modelo de texto rápido y con buen razonamiento. No necesita leer imágenes.' },
  { action: 'vision', label: 'Análisis visual', purpose: 'Leer planos y fotos, Amueblar y revisar las imágenes generadas.',
    advice: 'Tiene que admitir imágenes. Los modelos marcados como solo texto no sirven para este uso.' },
  { action: 'plano2d', label: 'Interpretación de planos', purpose: 'Convertir un plano en muros, huecos y estancias medidas.',
    advice: 'Un modelo con visión y precisión al medir; mejor uno de gama alta que uno barato.' },
  { action: 'memoria', label: 'Memoria del proyecto', purpose: 'Redactar la memoria de materiales y acabados.',
    advice: 'Un modelo de texto que escriba bien en español; la velocidad importa poco.' },
  { action: 'render3d', label: 'Imágenes del diseño', purpose: 'Generar las imágenes hiperrealistas a partir del plano.',
    advice: 'Un modelo de imagen que respete la geometría de la referencia. Cada imagen tiene un precio fijo.' },
  { action: 'inpaint', label: 'Retoques de imágenes', purpose: 'Cambiar una parte de una imagen ya aceptada sin rehacerla.',
    advice: 'Un modelo de edición que conserve lo que no se toca. Suele ser el mismo que el de imágenes.' },
];

/** Vídeos: Habiteka fija el modelo de cada tipo de vídeo (no entra en el mapeo por uso). Se muestran como información. */
export const VIDEO_MODEL_GUIDE: readonly { label: string; model: string; advice: string }[] = [
  { label: 'Paseo por las zonas (imagen a vídeo)', model: 'Hailuo 02 estándar',
    advice: 'Une dos imágenes aceptadas en cada tramo, de 6 o 10 segundos a 768p (unos 0,025 USD por segundo).' },
  { label: 'Construcción y visita (referencias a vídeo)', model: 'MiniMax H3 · referencias a vídeo',
    advice: 'Usa varias imágenes aceptadas del diseño como referencia para mantener el mismo inmueble en todo el vídeo.' },
];

export const MAX_MODEL_BACKUPS = 3;
