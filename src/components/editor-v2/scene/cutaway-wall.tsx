'use client';
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ExteriorWall } from '@/canvas/editor-v2/scene/types';

/** Camera-only visibility; selected walls remain present and the source document never changes. */
export function CutawayWall({ exterior, enabled, selected, children }: {
  exterior?: ExteriorWall; enabled: boolean; selected: boolean; children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (!group.current) return;
    group.current.visible = !enabled || selected || !exterior ||
      (camera.position.x - exterior.x) * exterior.normalX + (camera.position.z - exterior.z) * exterior.normalZ <= .01;
  });
  return <group ref={group}>{children}</group>;
}
