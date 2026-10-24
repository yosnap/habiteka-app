/**
 * Textos de la home. Solo describe funciones que existen (fuente: la guía de
 * usuario en docs/site); lo que sigue en desarrollo no se anuncia como disponible.
 * Sin precios, planes ni prueba social: el foco es el producto.
 */

export const DOCS_URL = 'https://docs.habiteka.app';

export interface LandingStep {
  title: string;
  body: string;
}

export const STEPS: LandingStep[] = [
  { title: 'Trae tu plano', body: 'Foto, boceto, PDF o CAD. Habiteka lo convierte en un plano editable con las cotas de cada estancia para revisarlas.' },
  { title: 'Completa el inmueble', body: 'Paredes, puertas, ventanas, escaleras, plantas, techos, tejado y muebles en Plano 2D, Amueblado y Modelo 3D.' },
  { title: 'Diseña con IA', body: 'Vistas fotorrealistas que respetan la distribución: cada estancia conserva su uso, sus puertas y sus huecos.' },
  { title: 'Revisa y acepta', body: 'Apruebas la versión del plano y aceptas cada diseño por separado. Nada se da por bueno sin ti.' },
  { title: 'Presenta el resultado', body: 'Imágenes finales, montajes publicitarios, pilotos de construcción y paseos en primera persona.' },
];

/** Cifras reales del producto (no métricas de uso). */
export const FACTS = [
  { value: '4', label: 'formatos de plano: foto, boceto, PDF y CAD' },
  { value: '3', label: 'vistas sincronizadas: 2D, Amueblado y 3D' },
  { value: '16:9 · 9:16', label: 'montajes horizontales y verticales' },
  { value: '60 s', label: 'de paseo en primera persona' },
];

export interface LandingTrustItem {
  title: string;
  body: string;
}

export const TRUST: LandingTrustItem[] = [
  { title: 'Tú apruebas cada versión', body: 'La aprobación fija geometría y medidas. Si cambias algo después, Habiteka te avisa de que el plano ya no coincide.' },
  { title: 'Aceptación explícita', body: 'Una revisión automática ayuda, pero solo los diseños que aceptas se usan en imágenes finales y vídeos.' },
  { title: 'Coste visible', body: 'Las acciones que usan IA muestran su precio y piden confirmación antes de generar.' },
  { title: 'Tus proyectos son tuyos', body: 'Exporta un proyecto completo en un archivo .habiteka e impórtalo en otra cuenta o instalación.' },
];

export interface LandingFaqItem {
  q: string;
  a: string;
}

export const FAQ: LandingFaqItem[] = [
  { q: '¿Necesito saber de CAD o de arquitectura?', a: 'No. Puedes partir de una foto del plano y revisar sus medidas en una tabla por estancias. El editor tiene vistas 2D y 3D y una guía paso a paso.' },
  { q: '¿La IA respeta mi distribución?', a: 'Las vistas se generan con la guía de estancias, puertas y huecos del plano guardado y se revisan antes de guardarse. La revisión automática puede equivocarse: por eso cada diseño necesita tu aceptación.' },
  { q: '¿Las imágenes valen como proyecto técnico?', a: 'No. Son propuestas para decidir y presentar. Antes de ejecutar una obra, valídalas con un profesional que firme el proyecto técnico.' },
  { q: '¿Qué vídeos puedo crear?', a: 'Montajes publicitarios con tus diseños, pilotos de construcción y paseos en primera persona de hasta un minuto. La visita virtual continua todavía está en desarrollo.' },
  { q: '¿Sé lo que cuesta antes de generar?', a: 'Sí. Cada acción que usa IA muestra su coste y te pide confirmación antes de empezar.' },
  { q: '¿Dónde aprendo a usarlo?', a: 'En la guía de usuario, con el proceso completo desde el primer proyecto hasta los vídeos.' },
];
