import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { ProjectEditor } from './project-editor';
import type { AutoGenerateRequest } from '../auto-generate-request';

export async function ProjectEditorPage({ projectId, zoneId, autoGenerate }: {
  projectId: string; zoneId?: string; autoGenerate?: AutoGenerateRequest | null;
}) {
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) notFound();

  const scope = { userId: ctx.userId, organizationId: ctx.organizationId, projectId, zoneId: zoneId ?? null };
  const source = await withEditorDocuments(ctx).load(scope);
  const conversion = source.authority === 'legacy' && source.legacySnapshot !== null
    ? fromCanvasV1(source.legacySnapshot)
    : null;

  return (
    <ProjectEditor
      key={JSON.stringify(scope)}
      scope={scope}
      projectName={project.title}
      autoGenerate={autoGenerate ?? null}
      initial={source.authority === 'v2' ? source.document : conversion?.document ?? emptyEditorDocument()}
      writable={source.authority === 'v2' && source.writable}
      migration={source.authority === 'legacy' ? {
        fingerprint: source.legacyFingerprint,
        complete: source.legacySnapshot === null || conversion?.complete === true,
        issues: conversion?.issues ?? [],
      } : null}
    />
  );
}
