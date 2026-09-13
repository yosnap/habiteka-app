import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { ProjectEditor } from '@/components/editor-v2/session/project-editor';

export default async function EditorPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ zona?: string }>;
}) {
  const { id } = await params, { zona } = await searchParams;
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();
  const scope = { userId: ctx.userId, organizationId: ctx.organizationId, projectId: id, zoneId: zona ?? null };
  const source = await withEditorDocuments(ctx).load(scope);
  const conversion = source.authority === 'legacy' && source.legacySnapshot !== null
    ? fromCanvasV1(source.legacySnapshot) : null;
  return <ProjectEditor key={JSON.stringify(scope)} scope={scope} projectName={project.title}
    initial={source.authority === 'v2' ? source.document : conversion?.document ?? emptyEditorDocument()}
    writable={source.authority === 'v2' && source.writable}
    migration={source.authority === 'legacy' ? {
      fingerprint: source.legacyFingerprint,
      complete: source.legacySnapshot === null || conversion?.complete === true,
      issues: conversion?.issues ?? [],
    } : null} />;
}
