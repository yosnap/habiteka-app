/**
 * Vídeos: reproductores simulados con fotogramas fijos de ejemplo (fundidos y
 * zoom lento en CSS) para el montaje 16:9, el vertical 9:16 y el paseo en
 * primera persona. Rotulados como simulación ilustrativa.
 */
import { Footprints, HardHat, Play } from 'lucide-react';
import { PHOTOS, type PhotoKey } from './landing-examples';
import { Reveal } from './landing-reveal';
import { AtlasPhoto, ExampleBadge, SectionIntro } from './landing-ui';
import styles from './landing.module.css';

function FrameLoop({ frames }: { frames: PhotoKey[] }) {
  return (
    <>
      {frames.map((key, index) => (
        <div key={key} className={`absolute inset-0 ${styles.frame}`} style={{ animationDelay: `${index * 4}s` }}>
          <AtlasPhoto photo={PHOTOS[key]} decorative className="size-full" />
        </div>
      ))}
    </>
  );
}

/** Panel fijo con las medidas globales del diseño aprobado, como el del montaje real. */
function GlobalDimensions() {
  return (
    <dl className="absolute bottom-20 left-5 grid grid-cols-3 gap-x-4 rounded-xl bg-black/55 px-4 py-2.5 font-mono text-[0.7rem] text-white backdrop-blur sm:text-xs">
      {[['Ancho', '14,20 m'], ['Fondo', '9,60 m'], ['Alto', '6,40 m']].map(([label, value]) => (
        <div key={label}>
          <dt className="text-white/60">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlayerChrome({ label }: { label: string }) {
  return (
    <>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
        <span className="text-ink grid size-9 shrink-0 place-items-center rounded-full bg-white"><Play className="size-4 fill-current" aria-hidden="true" /></span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><span className={`bg-brand-500 block h-full ${styles.progress}`} /></span>
        <span className="font-mono text-xs text-white/80">{label}</span>
      </div>
      <ExampleBadge className="absolute top-3 right-3" label="Simulación ilustrativa" />
    </>
  );
}

const WALK = ['Recibidor', 'Salón', 'Comedor', 'Cocina', 'Pasillo', 'Dormitorio'];

export function LandingVideos() {
  return (
    <section id="videos" className="bg-night relative isolate scroll-mt-16 overflow-hidden py-24 sm:py-32">
      <div aria-hidden="true" className={`bg-brand-500/25 absolute top-1/3 left-[-10%] -z-10 size-[40rem] rounded-full blur-[150px] ${styles.glow}`} />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionIntro
            dark
            eyebrow="Vídeos"
            title={<>Preséntalo <span className="text-brand-100 italic">en movimiento.</span></>}
            body="Todos los vídeos parten de los diseños que has aceptado, nunca del modelo de trabajo, y muestran su coste antes de generar."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-[2.2fr_1fr]">
          <Reveal className="flex min-w-0 flex-col gap-4">
            <div aria-label="Simulación de un montaje publicitario horizontal" role="img" className="relative aspect-video overflow-hidden rounded-[1.5rem] ring-1 ring-white/10">
              <FrameLoop frames={['salon', 'cocina', 'comedor', 'exterior']} />
              <GlobalDimensions />
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
              <span className="font-display absolute top-12 left-5 text-2xl sm:top-5 font-medium text-white drop-shadow sm:text-4xl">Casa de campo en Teruel</span>
              <PlayerChrome label="16:9" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Montaje publicitario 16:9 o 9:16</h3>
              <p className="mt-1 text-white/65">Con un panel de medidas globales del diseño (ancho, fondo y alto), si quieres.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-4">
            <div aria-label="Simulación de un montaje vertical para redes" role="img" className="relative mx-auto aspect-[9/16] w-full max-w-[19rem] overflow-hidden rounded-[1.5rem] ring-1 ring-white/10 lg:max-w-none">
              <FrameLoop frames={['dormitorio', 'bano', 'infantil', 'decoracion']} />
              <PlayerChrome label="9:16" />
            </div>
          </Reveal>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[2.2fr_1fr]">
          <Reveal className="min-w-0 rounded-[1.5rem] bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
            <div className="flex items-center gap-3 text-white">
              <Footprints className="text-brand-100 size-5" aria-hidden="true" />
              <h3 className="min-w-0 text-xl font-semibold">Paseo en primera persona</h3>
              <span className="font-display text-brand-100 ml-auto shrink-0 text-3xl whitespace-nowrap italic">60 s</span>
            </div>
            <p className="mt-2 text-white/65">Un paseo rápido de hasta 60 s por las zonas de una planta, generado por tramos desde tus diseños aceptados. Revisas cada tramo antes de componer el vídeo.</p>
            <div className="relative mt-8" aria-hidden="true">
              <div className="flex gap-1">
                {WALK.map((room) => (
                  <span key={room} className="min-w-0 flex-1 truncate rounded-md bg-white/10 px-1 sm:px-2 py-2 text-center text-[0.7rem] text-white/75 sm:text-xs">{room}</span>
                ))}
              </div>
              <span className={`absolute inset-x-0 -top-2 -bottom-2 ${styles.playhead}`}>
                <span className="bg-brand-500 block h-full w-0.5 rounded-full shadow-[0_0_14px_2px_var(--color-brand-500)]" />
              </span>
              <div className="mt-3 flex justify-between font-mono text-[0.7rem] text-white/45"><span>0:00</span><span>0:30</span><span>1:00</span></div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col justify-between gap-6 rounded-[1.5rem] bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
            <div>
              <HardHat className="text-brand-100 size-6" aria-hidden="true" />
              <h3 className="mt-3 text-xl font-semibold text-white">Piloto de construcción</h3>
              <p className="mt-2 text-white/65">La obra levantándose a partir de tus diseños aceptados.</p>
            </div>
            <p className="text-sm text-white/45">La visita virtual continua está en desarrollo.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
