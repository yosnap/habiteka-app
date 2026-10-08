import type { PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import { propertyVisitSequence } from '@/lib/editor-document/property-visit-job';
import type { PropertyVisitPlan } from '@/lib/editor-document/property-visit-types';
export function visitFixture(): PropertyVisitJob {
  const plan: PropertyVisitPlan = { entry: null, complete: true, issues: [], durationSeconds: 8,
    coverage: [{ id: 'ground:room', roomId: 'room', levelId: 'ground', name: 'Salón', status: 'planned' }],
    frames: [0, 1, 1].map((x, index) => ({ id: `frame-${index}`, label: `Vista ${index}`, roomId: 'room', levelId: 'ground', secondsFromPrevious: index ? 4 : 0,
      camera: { position: [x, 1.6, 0], focus: [x, 1.6, 1], fovDeg: 75, levelId: null } })) };
  return { type: 'video', mode: 'property-visit-ai', title: 'Paseo', approvalId: 'approval', approvedRevision: 7,
    approvedFingerprint: 'a'.repeat(64), lighting: 'daylight', openDoors: true, anchorIds: ['top', 'roof'], plan,
    ...propertyVisitSequence(plan), resolution: '768P', durationMs: 8000, imagePriceUsd: .08, imageModel: 'provider:model', createdAt: new Date().toISOString() };
}
