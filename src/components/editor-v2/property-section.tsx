import type { ReactNode } from 'react';
import styles from './selection-properties.module.css';

export function PropertySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.section} aria-label={title}>
    <h3>{title}</h3>
    {children}
  </section>;
}
