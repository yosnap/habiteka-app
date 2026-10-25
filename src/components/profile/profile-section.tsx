/** Cabecera común de cada sección de «Mi perfil». */
import type { ReactNode } from 'react';

export function ProfileSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-ink text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-ink-soft mt-1 max-w-3xl text-sm">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
