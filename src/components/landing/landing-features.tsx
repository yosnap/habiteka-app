/**
 * Sección de features de la landing: muestra las capacidades del editor profesional
 * de Habiteka. Diseño en grid con iconos, títulos y descripciones cortas.
 */
const FEATURES = [
  {
    icon: '🪄',
    title: 'Asistente de sala',
    desc: 'Crea salas en L, U o T en 3 pasos: forma, medidas y estilo. El asistente amuebla automáticamente.',
  },
  {
    icon: '🏠',
    title: 'Editor 3D navegable',
    desc: 'Orbita, arrastra muebles, abre puertas y ventanas. Colisiones suaves y menú radial tipo Planner5D.',
  },
  {
    icon: '📦',
    title: 'Catálogo extensible',
    desc: 'Mobiliario, sanitarios, cocina, iluminación. Sube tus propios modelos GLB y reutilízalos.',
  },
  {
    icon: '💡',
    title: 'Iluminación realista',
    desc: 'Luces de techo con temperatura de color (K), intensidad ajustable y cenefas LED perimetrales.',
  },
  {
    icon: '🎨',
    title: 'Elementos de pared',
    desc: 'Enchufes, interruptores, cuadros con imagen, TV de pared. Anclados al muro a altura real.',
  },
  {
    icon: '🔗',
    title: 'Comparte con clientes',
    desc: 'Link de solo lectura: tu cliente orbita el 3D sin instalar nada. Exporta el plano en PNG.',
  },
];

export function LandingFeatures() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <h2 className="text-ink mb-2 text-center text-3xl font-semibold tracking-tight">
        Todo lo que necesitas para diseñar un interior
      </h2>
      <p className="text-ink-soft mb-10 text-center text-lg">
        De la idea al render en minutos, sin software complejo.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="border-line bg-surface rounded-card border p-5 transition-shadow hover:shadow-md"
          >
            <span className="mb-3 block text-3xl">{f.icon}</span>
            <h3 className="text-ink mb-1 text-base font-semibold">{f.title}</h3>
            <p className="text-ink-soft text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
