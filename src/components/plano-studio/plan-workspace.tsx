import type { ReactNode } from 'react';
import { FileImage, LayoutTemplate, Sparkles, FilePlus } from 'lucide-react';
import { ProjectWorkspace, ProjectRailItem } from '@/components/app/project-workspace';
import { ProjectFloatingTools } from '@/components/app/project-floating-tools';

export function PlanWorkspace({ stage, tab, onTabChange, onNew, pending, children }: {
  stage: ReactNode; tab: 'plano' | 'vector' | 'render';
  onTabChange?: (tab: 'plano' | 'vector' | 'render') => void;
  onNew?: () => void; pending: boolean; children: ReactNode;
}) {
  return <ProjectWorkspace label="Espacio de plano" rail={<>
    <ProjectRailItem icon={FileImage} selected={tab === 'plano'} disabled={pending || !onTabChange} onClick={() => onTabChange?.('plano')}>Imagen del plano</ProjectRailItem>
    <ProjectRailItem icon={LayoutTemplate} selected={tab === 'vector'} disabled={pending || !onTabChange} onClick={() => onTabChange?.('vector')}>Muros y medidas</ProjectRailItem>
    <ProjectRailItem icon={Sparkles} selected={tab === 'render'} disabled={pending || !onTabChange} onClick={() => onTabChange?.('render')}>Vista generada</ProjectRailItem>
    <ProjectRailItem icon={FilePlus} disabled={pending || !onNew} onClick={onNew}>Nuevo plano</ProjectRailItem>
  </>}>
    <ProjectFloatingTools>{stage}</ProjectFloatingTools>
    {children}
  </ProjectWorkspace>;
}
