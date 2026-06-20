import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, makeUser } from '../helpers/db';
import {
  acceptTos,
  hasAcceptedCurrentTos,
  assertTosAccepted,
  TosNotAcceptedError,
  CURRENT_TOS_VERSION,
} from '@/server/legal/tos-acceptance-service';

beforeEach(async () => {
  await resetDb();
});

describe('tos-acceptance-service (gate de generación)', () => {
  it('sin aceptación, hasAccepted=false y assert bloquea', async () => {
    const user = await makeUser();
    expect(await hasAcceptedCurrentTos(user.id)).toBe(false);
    await expect(assertTosAccepted(user.id)).rejects.toBeInstanceOf(TosNotAcceptedError);
  });

  it('tras aceptar la versión vigente, assert pasa', async () => {
    const user = await makeUser();
    await acceptTos(user.id);
    expect(await hasAcceptedCurrentTos(user.id)).toBe(true);
    await expect(assertTosAccepted(user.id)).resolves.toBeUndefined();
  });

  it('aceptar una versión antigua no vale para la vigente', async () => {
    const user = await makeUser();
    await acceptTos(user.id, 'version-vieja');
    expect(CURRENT_TOS_VERSION).not.toBe('version-vieja');
    expect(await hasAcceptedCurrentTos(user.id)).toBe(false);
  });
});
