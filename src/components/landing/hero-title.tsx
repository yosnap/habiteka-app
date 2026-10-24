/**
 * Titular del hero: cada línea sube desde detrás de una máscara, escalonada. Es
 * CSS puro para que el titular se pinte sin esperar a JavaScript; con movimiento
 * reducido aparece directamente.
 */
import hero from './hero.module.css';

const LINES: { text: string; accent?: boolean }[] = [
  { text: 'Del plano' },
  { text: 'a tu casa,' },
  { text: 'antes de construirla.', accent: true },
];

export function HeroTitle() {
  return (
    <h1 className="font-display text-[clamp(2.9rem,8.2vw,6.6rem)] leading-[0.95] font-medium tracking-[-0.035em] text-white">
      {LINES.map((line, index) => (
        <span key={line.text} className="block overflow-hidden pb-[0.08em]">
          <span
            className={`${hero.rise} ${line.accent ? 'text-brand-100 italic' : ''}`}
            style={{ animationDelay: `${0.15 + index * 0.12}s` }}
          >
            {line.text}
          </span>
        </span>
      ))}
    </h1>
  );
}
