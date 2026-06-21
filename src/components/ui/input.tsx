import * as React from 'react';
import { cn } from '@/lib/utils';

/** Campo de texto base, alineado con los tokens de marca (línea, radio, foco). */
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-line bg-surface text-ink placeholder:text-ink-soft flex h-10 w-full rounded-control border px-3 py-2 text-sm transition-colors',
        'focus-visible:border-brand-500 focus-visible:ring-brand-500/30 outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
