import { describe, expect, it } from 'vitest';
import { documentationUpdateIssue } from '../../scripts/docs-update-policy.mjs';

describe('documentación obligatoria', () => {
  it('rechaza cambios de producto sin guía de usuario aunque exista un reporte técnico', () => {
    expect(documentationUpdateIssue(['src/components/editor.tsx', 'docs/system-architecture.md'])).toBeTruthy();
  });
  it('acepta código de producto acompañado de la guía pertinente', () => {
    expect(documentationUpdateIssue(['src/components/editor.tsx', 'docs/site/src/content/docs/editor/atajos.md'])).toBeNull();
  });
  it('exige documentación técnica para infraestructura y no acepta solo un reporte', () => {
    expect(documentationUpdateIssue(['Dockerfile', 'plans/reports/cambio.md'])).toBeTruthy();
    expect(documentationUpdateIssue(['Dockerfile', 'docs/documentacion-starlight.md'])).toBeNull();
  });
  it('no exige una modificación adicional para un cambio solo de documentación', () => {
    expect(documentationUpdateIssue(['docs/site/src/content/docs/editor/atajos.md'])).toBeNull();
  });
});
