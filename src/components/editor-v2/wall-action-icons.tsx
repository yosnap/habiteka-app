import { createLucideIcon } from 'lucide-react';

export const CurvedWallIcon = createLucideIcon('CurvedWall', [
  ['path', { d: 'M3 18Q12 0 21 18', key: 'arc' }],
  ['circle', { cx: '3', cy: '18', r: '1.5', fill: 'currentColor', key: 'start' }],
  ['circle', { cx: '21', cy: '18', r: '1.5', fill: 'currentColor', key: 'end' }],
]);
export const StraightWallIcon = createLucideIcon('StraightWall', [
  ['path', { d: 'M3 12H21', key: 'line' }],
  ['path', { d: 'M3 8V16M21 8V16', key: 'ends' }],
]);
export const AddWallVertexIcon = createLucideIcon('AddWallVertex', [
  ['path', { d: 'M4 20V7H20', key: 'corner' }],
  ['circle', { cx: '4', cy: '7', r: '2.5', fill: 'white', key: 'vertex' }],
  ['path', { d: 'M15 13V21M11 17H19', key: 'add' }],
]);
