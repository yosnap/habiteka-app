import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import { VideoStudioWorkspace } from '@/components/editor-v2/video-studio-workspace';

export default async function VideosPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ zona?: string }>;
}) {
  const { id } = await params, { zona } = await searchParams;
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();
  const scope = { projectId: id, zoneId: zona ?? null };
  const documents = withEditorDocuments(ctx);
  const source = await documents.load(scope);
  const approval = source.authority === 'v2' ? await documents.latestApproval(scope) : null;
  return <VideoStudioWorkspace key={JSON.stringify(scope)} scope={scope} projectName={project.title}
    approval={approval} approvalCurrent={Boolean(approval && source.authority === 'v2' && sameDesignContent(source.document, approval.document))}
    writable={source.authority === 'v2' && source.writable} />;
}
