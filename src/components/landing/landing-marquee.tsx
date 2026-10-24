/**
 * Marquesina de estancias: dos filas de fotos que se desplazan en sentidos
 * opuestos (se pausan al pasar el ratón y con movimiento reducido).
 */
import { MARQUEE_ROWS, PHOTOS } from './landing-examples';
import { AtlasPhoto } from './landing-ui';
import styles from './landing.module.css';

export function LandingMarquee() {
  return (
    <section aria-labelledby="estancias-titulo" className="bg-night overflow-hidden pb-20">
      <div className="mx-auto mb-10 flex w-full max-w-7xl flex-wrap items-end justify-between gap-4 px-4 sm:px-6">
        <h2 id="estancias-titulo" className="font-display max-w-xl text-3xl font-medium tracking-tight text-white sm:text-4xl">
          Cada estancia, <span className="text-brand-100 italic">con su propio diseño.</span>
        </h2>
        <p className="text-sm text-white/50">Fotos del catálogo y ejemplos ilustrativos</p>
      </div>
      <div className={`flex flex-col gap-4 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)] ${styles.marqueeHost}`}>
        {MARQUEE_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className={`${styles.marquee} ${rowIndex % 2 ? styles.marqueeReverse : ''}`}>
            {/* La fila se duplica para que el bucle sea continuo; la copia es decorativa. */}
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 gap-4 pr-4">
                {row.map((item) => (
                  <li key={item.key} className="relative w-56 shrink-0 sm:w-72">
                    <AtlasPhoto photo={PHOTOS[item.key]} decorative={copy === 1} className="aspect-[3/2] rounded-2xl ring-1 ring-white/10" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
