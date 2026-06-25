import { describe, it, expect, beforeEach } from 'vitest';
import { castVote, tallyVotes } from '@/addons/voting/server/vote-service';
import { addComment, listComments } from '@/addons/voting/server/comment-service';
import { roomDelta } from '@/addons/voting/server/deltas';
import { VOTING_ADDON, registerVotingAddon } from '@/addons/voting/voting-addon';
import { createAddonRegistry } from '@/lib/addons/registry';
import { prisma } from '@/server/db/prisma';
import { resetDb, makeOrg } from '../helpers/db';

async function makeRoom(): Promise<string> {
  const org = await makeOrg(0);
  const project = await prisma.project.create({ data: { organizationId: org, title: 'P' } });
  const room = await prisma.votingRoom.create({
    data: { projectId: project.id, title: 'Sala', shareSlug: `slug-${project.id}` },
  });
  return room.id;
}

describe('voting add-on — registro', () => {
  it('se registra en los slots correctos del registry de F0', () => {
    const registry = registerVotingAddon(createAddonRegistry());
    const def = registry.get('voting');
    expect(def).toEqual(VOTING_ADDON);
    expect(def?.slots).toContain('agent.postEntrega');
  });
});

describe('vote-service — un voto por usuario y elemento', () => {
  beforeEach(resetDb);

  it('votar de nuevo actualiza el valor, no duplica', async () => {
    const room = await makeRoom();
    await castVote({ votingRoomId: room, targetRef: 'puerta', voterId: 'u1', value: 1 });
    await castVote({ votingRoomId: room, targetRef: 'puerta', voterId: 'u1', value: -1 });

    const count = await prisma.vote.count({ where: { votingRoomId: room } });
    expect(count).toBe(1); // mismo usuario+elemento = un único voto

    const tally = await tallyVotes(room);
    expect(tally.find((t) => t.targetRef === 'puerta')?.total).toBe(-1); // valor actualizado
  });

  it('agrega votos de usuarios distintos sobre el mismo elemento', async () => {
    const room = await makeRoom();
    await castVote({ votingRoomId: room, targetRef: 'azulejo', voterId: 'u1', value: 1 });
    await castVote({ votingRoomId: room, targetRef: 'azulejo', voterId: 'u2', value: 1 });
    const tally = await tallyVotes(room);
    expect(tally.find((t) => t.targetRef === 'azulejo')?.total).toBe(2);
    expect(tally.find((t) => t.targetRef === 'azulejo')?.votes).toBe(2);
  });
});

describe('comment-service + deltas', () => {
  beforeEach(resetDb);

  it('crea comentarios y los devuelve por elemento', async () => {
    const room = await makeRoom();
    await addComment({ votingRoomId: room, targetRef: 'color', authorId: 'u1', body: 'Me gusta' });
    const comments = await listComments(room, 'color');
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('Me gusta');
  });

  it('rechaza un comentario vacío', async () => {
    const room = await makeRoom();
    await expect(
      addComment({ votingRoomId: room, authorId: 'u1', body: '   ' }),
    ).rejects.toBeTruthy();
  });

  it('los deltas devuelven solo los comentarios posteriores a `since`', async () => {
    const room = await makeRoom();
    await addComment({ votingRoomId: room, authorId: 'u1', body: 'antiguo' });
    const cut = new Date();
    // Pequeña espera lógica: el siguiente comentario es posterior al corte.
    await new Promise((r) => setTimeout(r, 5));
    await addComment({ votingRoomId: room, authorId: 'u1', body: 'nuevo' });

    const delta = await roomDelta(room, cut);
    expect(delta.newComments).toHaveLength(1);
    expect(delta.newComments[0]?.body).toBe('nuevo');
    expect(delta.cursor).toBeTruthy();
  });
});
