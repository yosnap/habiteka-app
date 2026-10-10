import { afterEach, expect, it, vi } from 'vitest';
import {
  parseWorkspaceView,
  readWorkspaceView,
  workspaceViewKey,
  writeWorkspaceView,
} from '@/components/editor-v2/workspace/workspace-view-state';
import { parseWorkspaceCamera } from '@/components/editor-v2/workspace/workspace-camera-state';

afterEach(() => vi.unstubAllGlobals());

it('el retorno nunca comparte la vista entre usuarios, proyectos o zonas', () => {
  const scope = workspaceViewKey('user-a', 'project-a', 'zone-a');
  expect(scope).not.toBe(workspaceViewKey('user-b', 'project-a', 'zone-a'));
  expect(scope).not.toBe(workspaceViewKey('user-a', 'project-b', 'zone-a'));
  expect(scope).not.toBe(workspaceViewKey('user-a', 'project-a', null));
  expect(workspaceViewKey(undefined, 'project-a', null)).toBeNull();
  expect(parseWorkspaceView('obsolete')).toBe('2d');
});

it('puede cambiar de vista cuando el navegador bloquea su almacenamiento', () => {
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: () => {
        throw new Error('disabled');
      },
      setItem: () => {
        throw new Error('disabled');
      },
    },
  });
  const key = workspaceViewKey('blocked-user', 'project', null);
  expect(readWorkspaceView(key)).toBe('2d');
  writeWorkspaceView(key, '3d');
  expect(readWorkspaceView(key)).toBe('3d');
  writeWorkspaceView(key, 'visual');
  expect(readWorkspaceView(key)).toBe('visual');
});

it('conserva la navegación si guardar falla por cuota y leer sigue permitido', () => {
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    },
  });
  const key = workspaceViewKey('quota-user', 'project', null);
  writeWorkspaceView(key, '3d');
  expect(readWorkspaceView(key)).toBe('3d');
});

it('descarta cámaras corruptas, posiciones inválidas y ojo coincidente con objetivo', () => {
  const pose = { position: [4, 5, 6], target: [0, 0, 0], fov: 50 };
  expect(parseWorkspaceCamera(JSON.stringify(pose))).toEqual(pose);
  for (const raw of [
    null,
    '{bad',
    'null',
    '{}',
    JSON.stringify({ ...pose, fov: 180 }),
    JSON.stringify({ ...pose, position: [0, 0, 0] }),
    JSON.stringify({ ...pose, target: [0, 1] }),
    JSON.stringify({ ...pose, position: [Infinity, 0, 0] }),
  ]) {
    expect(parseWorkspaceCamera(raw)).toBeNull();
  }
});

it('prioriza el último cambio local si la cuota impide sustituir una vista guardada', () => {
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: () => '2d',
      setItem: () => {
        throw new Error('quota');
      },
    },
  });
  const key = workspaceViewKey('existing-quota-user', 'project', null);
  expect(readWorkspaceView(key)).toBe('2d');
  writeWorkspaceView(key, '3d');
  expect(readWorkspaceView(key)).toBe('3d');
});
