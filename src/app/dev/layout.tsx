import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

/** Barrera de servidor compartida por todas las páginas de demostración. */
export default function DevelopmentLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return children;
}
