/**
 * Sección "cómo funciona": tres pasos del flujo del producto, para que un
 * visitante entienda la promesa de un vistazo.
 */
const STEPS = [
  {
    n: '1',
    title: 'Sube tu espacio',
    body: 'Una foto de la habitación o un boceto a mano alzada. Nosotros detectamos muros, ventanas y puertas.',
  },
  {
    n: '2',
    title: 'Describe tu idea',
    body: 'Cuéntale al asistente el estilo y el objetivo. Afina el resultado en una conversación natural.',
  },
  {
    n: '3',
    title: 'Recibe tu proyecto',
    body: 'Plano 2D, render 3D y memoria. Itera por zonas hasta que encaje y compártelo para validarlo.',
  },
];

export function LandingHowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <h2 className="text-ink mb-10 text-center text-2xl font-semibold tracking-tight">
        Cómo funciona
      </h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="border-line bg-surface rounded-card border p-6 shadow-[var(--shadow-panel)]"
          >
            <div className="bg-brand-500 mb-4 flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white">
              {s.n}
            </div>
            <h3 className="text-ink mb-2 font-medium">{s.title}</h3>
            <p className="text-ink-soft text-sm">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
