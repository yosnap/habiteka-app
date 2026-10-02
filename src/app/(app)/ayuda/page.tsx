/**
 * Página de ayuda: herramientas, atajos de teclado y flujo del estudio de
 * planos. Contenido estático (sin datos de proyecto), accesible desde la
 * cabecera en cualquier pantalla. Fuente de verdad de cada atajo: el manejador
 * de teclado del editor (`editor-shell.tsx`) y el visor de planos
 * (`canvas-view.tsx`, `plan-image-viewer.tsx`).
 */
import { Key, Plus, ShortcutRow } from '@/components/app/help-shortcut-row';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'Ayuda — Habiteka' };

function Section({
  title,
  hint,
  wide,
  children,
}: {
  title: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={`p-4 ${wide ? 'sm:col-span-2' : ''}`}>
      <h2 className="text-ink mb-1 text-base font-semibold">{title}</h2>
      {hint ? <p className="text-ink-soft mb-3 text-xs">{hint}</p> : null}
      {children}
    </Card>
  );
}

export default function AyudaPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-semibold tracking-tight">Ayuda</h1>
        <p className="text-ink-soft mt-1 text-sm">
          Guía de proyectos, parcela, diseños y vídeos. Herramientas y atajos del editor.
        </p>
      </div>

      <Card className="mb-8 border-brand-100 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold">Manual de Habiteka</h2>
        <p className="mt-2 text-sm text-ink-soft">Guías de proyectos, parcela real, imágenes y vídeos, herramientas, atajos y resolución de problemas.</p>
        <a className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          href={process.env.NODE_ENV === 'development' ? 'http://docs.localhost:3040' : 'https://docs.habiteka.app'}>
          Abrir documentación
        </a>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Herramientas" hint="Pulsa la tecla con el foco fuera de un campo de texto.">
          <ShortcutRow keys={<Key>S</Key>} label="Seleccionar" />
          <ShortcutRow keys={<Key>B</Key>} label="Dibujar paredes" />
          <ShortcutRow keys={<Key>R</Key>} label="Dibujar habitación" />
          <ShortcutRow keys={<Key>D</Key>} label="Colocar puerta" />
          <ShortcutRow keys={<Key>V</Key>} label="Colocar ventana" />
          <ShortcutRow keys={<Key>H</Key>} label="Colocar hueco" />
          <ShortcutRow keys={<Key>M</Key>} label="Medir distancia" />
          <ShortcutRow keys={<Key>F</Key>} label="Abrir catálogo (amueblar)" />
          <p className="text-ink-soft mt-2 text-xs">
            Sin tecla directa, desde «Construir»: murete de protección · formas · rampas ·
            escaleras · columnas · añadir esquina.
          </p>
        </Section>

        <Section title="Atajos de teclado">
          <ShortcutRow
            keys={
              <>
                <Key>⌘</Key>/<Key>Ctrl</Key>
                <Plus />
                <Key>Z</Key>
              </>
            }
            label="Deshacer"
          />
          <ShortcutRow
            keys={
              <>
                <Key>⇧</Key>
                <Plus />
                <Key>⌘</Key>
                <Plus />
                <Key>Z</Key>
              </>
            }
            label="Rehacer"
          />
          <ShortcutRow
            keys={
              <>
                <Key>⌘</Key>
                <Plus />
                <Key>C</Key>
              </>
            }
            label="Copiar"
            note="una sola selección"
          />
          <ShortcutRow
            keys={
              <>
                <Key>⌘</Key>
                <Plus />
                <Key>V</Key>
              </>
            }
            label="Pegar"
          />
          <ShortcutRow
            keys={
              <>
                <Key>⌘</Key>
                <Plus />
                <Key>A</Key>
              </>
            }
            label="Seleccionar todo"
          />
          <ShortcutRow keys={<Key>Supr</Key>} label="Eliminar la selección" />
          <ShortcutRow keys={<Key>↑ ↓ ← →</Key>} label="Mover la selección" note="1 cm" />
          <ShortcutRow
            keys={
              <>
                <Key>⇧</Key>
                <Plus />
                <Key>↑ ↓ ← →</Key>
              </>
            }
            label="Mover la selección"
            note="10 cm"
          />
          <ShortcutRow keys={<Key>Esc</Key>} label="Cancelar el trazo o cerrar el panel abierto" />
        </Section>

        <Section title="Selección con el ratón">
          <ShortcutRow keys={<span className="text-ink-soft text-xs">arrastrar</span>} label="Marco de selección" />
          <ShortcutRow
            keys={
              <>
                <Key>⇧</Key>/<Key>⌘</Key>
              </>
            }
            label="Sumar a la selección"
          />
          <ShortcutRow keys={<Key>⌥</Key>} label="Restar de la selección" />
        </Section>

        <Section
          title="Navegación del plano"
          hint="Barra fija abajo a la izquierda, en el editor y en el visor del estudio."
        >
          <ShortcutRow keys={<span className="text-ink-soft text-xs">rueda</span>} label="Acercar / alejar sobre el puntero" />
          <ShortcutRow keys={<span className="text-ink-soft text-xs">− / +</span>} label="Alejar / acercar" />
          <ShortcutRow keys={<span className="text-ink-soft text-xs">Encuadrar</span>} label="Ajusta el plano entero a la pantalla" />
          <ShortcutRow keys={<span className="text-ink-soft text-xs">Mano</span>} label="Arrastra el plano para desplazarlo" />
        </Section>

        <Section title="Estudio de planos" wide>
          <ol className="grid gap-3 sm:grid-cols-5">
            {[
              { title: 'Fuente', note: 'Sube una foto o un PDF, dibuja a mano, o trae el plano ya dibujado en el editor.' },
              { title: 'Redibujar con IA', note: 'Técnico (solo estructura, el mejor origen para importar) o decorado (con mobiliario). Se guardan los dos y se puede alternar.' },
              { title: 'Importar este plano', note: 'Lee muros, huecos, estancias y cotas de la imagen activa; abre la tabla de medidas.' },
              { title: 'Revisar la tabla', note: 'Corrige una medida y «Recalcula» sin volver a llamar a la IA. «Ancho total real» fija la escala si falta.' },
              { title: 'Enviar al editor', note: 'Reemplaza el plano actual del proyecto; pide confirmación antes.' },
            ].map((step, i) => (
              <li key={step.title} className="flex flex-col gap-1">
                <span className="bg-brand-500 text-surface flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-ink text-sm font-medium">{step.title}</span>
                <span className="text-ink-soft text-xs">{step.note}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Otros controles" wide>
          <p className="text-ink-soft text-sm">
            Deshacer · Rehacer · Diseñar con IA · Exportar · Guardar · 2D / 3D · Texto ·
            Propiedades · Recorrido · Techo y luces · Vista cenital (estudio)
          </p>
        </Section>
      </div>

      <p className="text-ink-soft mt-6 text-xs">
        Los atajos de letra se pueden desactivar desde el menú de visibilidad, arriba a la
        izquierda del editor — útil al escribir texto sobre el plano.
      </p>
    </main>
  );
}
