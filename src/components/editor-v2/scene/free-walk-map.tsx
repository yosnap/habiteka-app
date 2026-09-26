'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { wallPath } from '@/lib/editor-document/wall-path';
import type { FreeWalkController } from './free-walk-controller';
import styles from './free-walk-overlay.module.css';

const MAP_WIDTH = 216, MAP_HEIGHT = 176, PADDING = 13;

export function FreeWalkMap({ document, start, controller }: {
  document: EditorDocument;
  start: Point;
  controller: FreeWalkController;
}) {
  const pose = useSyncExternalStore(controller.subscribe, controller.getPose, controller.getPose);
  const levelId = pose?.levelId ?? document.activeLevelId ?? 'ground';
  const plan = useMemo(() => buildingDocuments(document).find((level) => level.id === levelId)?.document ?? document, [document, levelId]);
  const nav = useMemo(() => walkthroughNavigation(plan), [plan]);
  const map = useMemo(() => {
    const xs = plan.vertices.map((vertex) => vertex.x), ys = plan.vertices.map((vertex) => vertex.y);
    if (!xs.length) return null;
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const scale = Math.min((MAP_WIDTH - PADDING * 2) / Math.max(1, Math.max(...xs) - minX),
      (MAP_HEIGHT - PADDING * 2) / Math.max(1, Math.max(...ys) - minY));
    const x = (value: number) => PADDING + (value - minX) * scale;
    const y = (value: number) => PADDING + (value - minY) * scale;
    const walls: { id: string; points: string }[] = [];
    const windows: { id: string; points: string }[] = [];
    const points = (samples: Point[]) => samples.map((point) => `${x(point.x)},${y(point.y)}`).join(' ');
    const outdoorEdges = plan.walls.filter((wall) => wall.hidden && wall.id.startsWith('outdoor:'))
      .map((wall) => ({ id: wall.id, points: points(wallPath(plan, wall).samples()) }));
    plan.walls.filter((wall) => !wall.hidden).forEach((wall) => {
      const path = wallPath(plan, wall);
      const openings = plan.openings.filter((opening) => opening.wallId === wall.id)
        .map((opening) => ({ opening, from: Math.max(0, opening.position - opening.widthMm / 2 / path.length),
          to: Math.min(1, opening.position + opening.widthMm / 2 / path.length) }))
        .sort((a, b) => a.from - b.from);
      let cursor = 0;
      openings.forEach(({ opening, from, to }) => {
        if (from > cursor) walls.push({ id: `${wall.id}:${cursor}`, points: points(path.samples(cursor, from)) });
        if (opening.kind === 'ventana') windows.push({ id: opening.id, points: points(path.samples(from, to)) });
        cursor = Math.max(cursor, to);
      });
      if (cursor < 1) walls.push({ id: `${wall.id}:${cursor}`, points: points(path.samples(cursor)) });
    });
    const doors = plan.openings.filter((opening) => opening.kind !== 'ventana').flatMap((opening) => {
      const wall = plan.walls.find((item) => item.id === opening.wallId);
      if (!wall) return [];
      const point = wallPath(plan, wall).at(opening.position);
      return [{ id: opening.id, x: x(point.x), y: y(point.y) }];
    });
    return { x, y, walls, windows, doors, outdoorEdges };
  }, [plan]);
  if (!map) return null;
  const point = pose ?? { ...start, yaw: 0 };
  const room = nav.roomAt(point);
  const roomName = room && plan.labels.find((label) => insideRoom(label, room.boundary))?.text;
  const levelName = document.levels?.find((level) => level.id === levelId)?.name;
  const px = map.x(point.x), py = map.y(point.y);
  return <div className={styles.miniMap} aria-label="Mini plano de la visita">
    <div className={styles.miniMapTitle}>Mini plano{levelName ? ` · ${levelName}` : ''} <span>{roomName ?? (room ? 'Estancia' : 'Paso')}</span></div>
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Posición y dirección en el plano">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f3f5f0" rx="7" />
      {map.walls.map((wall) => <polyline key={wall.id} points={wall.points} fill="none"
        stroke="#39534d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
      {map.windows.map((window) => <polyline key={window.id} points={window.points} fill="none"
        stroke="#75b6c7" strokeWidth="2" strokeLinecap="round" />)}
      {map.outdoorEdges.map((edge) => <polyline key={edge.id} points={edge.points} fill="none"
        stroke="#78a58b" strokeWidth="1.5" strokeDasharray="3 3" />)}
      {map.doors.map((door) => <circle key={door.id} cx={door.x} cy={door.y} r="4" fill="#47a883" stroke="#fff" strokeWidth="1.5" />)}
      <circle cx={px} cy={py} r="6" fill="#ea6a3d" stroke="#fff" strokeWidth="2" />
      <line x1={px} y1={py} x2={px + Math.sin(point.yaw) * 15} y2={py + Math.cos(point.yaw) * 15}
        stroke="#ea6a3d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>;
}
