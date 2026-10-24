/** Fuente editorial de los titulares de la home (expone `--font-fraunces`). */
import { Fraunces } from 'next/font/google';

export const displayFont = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  style: ['normal', 'italic'],
  display: 'swap',
});
