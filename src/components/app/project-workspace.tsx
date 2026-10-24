import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import ui from './project-workspace.module.css';

export function ProjectWorkspace({ rail, footer, panel, children, label }: { rail: ReactNode; footer?: ReactNode; panel?: ReactNode; children: ReactNode; label: string }) {
  return <section className={`${ui.frame} ${panel ? ui.withPanel : ''}`} aria-label={label}>
    <aside className={ui.rail}><div className={ui.tasks}>{rail}</div>{footer && <div className={ui.footer}>{footer}</div>}</aside>
    {panel && <div className={ui.panel}>{panel}</div>}
    <div className={ui.content}>{children}</div>
  </section>;
}

export function ProjectRailItem({ icon: Icon, children, selected, href, onClick, disabled }: {
  icon: LucideIcon; children: ReactNode; selected?: boolean; href?: string; onClick?: () => void; disabled?: boolean;
}) {
  const content = <><Icon size={21} aria-hidden="true" /><span>{children}</span></>;
  return href ? <Link className={ui.item} href={href} aria-current={selected ? 'page' : undefined}>{content}</Link>
    : <button type="button" className={ui.item} aria-pressed={selected} disabled={disabled} onClick={onClick}>{content}</button>;
}
