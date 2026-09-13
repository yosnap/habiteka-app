'use client';
import { Group, Circle, Text } from 'react-konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { commentAnchor } from '@/lib/editor-document/comment-anchor';

export function CommentMarkers({ doc, store, scale }: { doc: EditorDocument; store: EditorStore; scale: number }) {
  const targets = [...new Set(doc.comments?.map((c) => c.targetEntityId) ?? [])];
  return <Group>{targets.map((id) => {
    const comments = doc.comments!.filter((c) => c.targetEntityId === id), p = commentAnchor(doc, comments[0]!);
    if (!p) return null;
    const open = () => { store.getState().select([id]); store.getState().setDetailPanel('comments'); };
    return <Group key={id} x={p.x} y={p.y - 24 / scale} onClick={(e) => { e.cancelBubble = true; open(); }}
      onTap={(e) => { e.cancelBubble = true; open(); }}>
      <Circle radius={12 / scale} fill="#087f75" stroke="white" strokeWidth={2 / scale} />
      <Text x={-10 / scale} y={-7 / scale} width={20 / scale} text={String(comments.length)} fontSize={13 / scale} fill="white" align="center" listening={false} />
    </Group>;
  })}</Group>;
}
