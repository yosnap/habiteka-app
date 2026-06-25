import { describe, it, expect, beforeEach } from 'vitest';
import { withOrg } from '@/server/db/scoped-repo';
import { makeOrg, resetDb } from '../helpers/db';
import type { OrgContext } from '@/server/auth/org-context';

function ctx(organizationId: string): OrgContext {
  return { organizationId, userId: 'u1', role: 'owner' };
}

describe('Scoping estructural por organización (anti-IDOR)', () => {
  beforeEach(resetDb);

  it('list solo devuelve recursos de la organización del contexto', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await withOrg(ctx(orgA)).projects.create({ title: 'A' });
    await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    const listA = await withOrg(ctx(orgA)).projects.list();
    expect(listA).toHaveLength(1);
    expect(listA[0]?.title).toBe('A');
  });

  it('findById de un recurso de otra org devuelve null (no fuga por id)', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    // orgA conoce el id de orgB pero el scoping impide leerlo.
    const leaked = await withOrg(ctx(orgA)).projects.findById(projB.id);
    expect(leaked).toBeNull();
  });

  it('delete no borra recursos de otra org', async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

    await withOrg(ctx(orgA)).projects.delete(projB.id); // no debe afectar a B
    expect(await withOrg(ctx(orgB)).projects.findById(projB.id)).not.toBeNull();
  });

  describe('sourceImages (imagen de origen)', () => {
    const img = { key: 'k', mime: 'image/png', faceBlurred: false };

    it('create de una imagen en un proyecto ajeno lanza (anti-IDOR)', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

      await expect(withOrg(ctx(orgA)).sourceImages.create(projB.id, img)).rejects.toThrow();
    });

    it('list solo devuelve imágenes de la organización del contexto', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });
      await withOrg(ctx(orgA)).sourceImages.create(projA.id, img);
      await withOrg(ctx(orgB)).sourceImages.create(projB.id, img);

      const listA = await withOrg(ctx(orgA)).sourceImages.list(projA.id);
      expect(listA).toHaveLength(1);
      // orgA no ve las imágenes del proyecto de orgB ni conociendo su id.
      expect(await withOrg(ctx(orgA)).sourceImages.list(projB.id)).toHaveLength(0);
    });

    it('latestPrimaryId devuelve la PRIMARY más reciente del proyecto, o null', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      expect(await withOrg(ctx(orgA)).sourceImages.latestPrimaryId(projA.id)).toBeNull();

      const first = await withOrg(ctx(orgA)).sourceImages.create(projA.id, img);
      const second = await withOrg(ctx(orgA)).sourceImages.create(projA.id, img);
      const latest = await withOrg(ctx(orgA)).sourceImages.latestPrimaryId(projA.id);
      // La más reciente gana; ambas son válidas pero debe ser una de las creadas.
      expect([first.id, second.id]).toContain(latest);
    });

    it('latestPrimary devuelve id+key+mime de la PRIMARY (para leer sus bytes), o null', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      expect(await withOrg(ctx(orgA)).sourceImages.latestPrimary(projA.id)).toBeNull();

      const created = await withOrg(ctx(orgA)).sourceImages.create(projA.id, img);
      const ref = await withOrg(ctx(orgA)).sourceImages.latestPrimary(projA.id);
      expect(ref).toMatchObject({ id: created.id, key: img.key, mime: img.mime });
    });

    it('listByZone devuelve solo las fotos de esa (proyecto, zona)', async () => {
      const orgA = await makeOrg();
      const repo = withOrg(ctx(orgA));
      const projA = await repo.projects.create({ title: 'A' });
      const zona = await repo.zones.create(projA.id, { name: 'Cocina' });

      await repo.sourceImages.create(projA.id, { ...img, zoneId: zona.id });
      await repo.sourceImages.create(projA.id, { ...img, zoneId: zona.id });
      await repo.sourceImages.create(projA.id, { ...img, zoneId: null }); // otra zona (defecto)

      const enZona = await repo.sourceImages.listByZone(projA.id, zona.id);
      expect(enZona).toHaveLength(2);
      const porDefecto = await repo.sourceImages.listByZone(projA.id, null);
      expect(porDefecto).toHaveLength(1);
    });

    it('setActive deja UNA PRIMARY y el resto DETAIL en la zona', async () => {
      const orgA = await makeOrg();
      const repo = withOrg(ctx(orgA));
      const projA = await repo.projects.create({ title: 'A' });
      const zona = await repo.zones.create(projA.id, { name: 'Salón' });

      const a = await repo.sourceImages.create(projA.id, { ...img, zoneId: zona.id });
      const b = await repo.sourceImages.create(projA.id, { ...img, zoneId: zona.id });

      const changed = await repo.sourceImages.setActive(projA.id, zona.id, a.id);
      expect(changed).toBe(true);

      const fotos = await repo.sourceImages.listByZone(projA.id, zona.id);
      const primarias = fotos.filter((f) => f.role === 'PRIMARY');
      expect(primarias).toHaveLength(1);
      expect(primarias[0]?.id).toBe(a.id);
      expect(fotos.find((f) => f.id === b.id)?.role).toBe('DETAIL');
      // Y la activa coincide con latestPrimary.
      expect((await repo.sourceImages.latestPrimary(projA.id, zona.id))?.id).toBe(a.id);
    });

    it('setActive de una imagen ajena (otra org) no cambia nada (anti-IDOR)', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const repoA = withOrg(ctx(orgA));
      const repoB = withOrg(ctx(orgB));
      const projB = await repoB.projects.create({ title: 'B' });
      const zonaB = await repoB.zones.create(projB.id, { name: 'B-zona' });
      const fotoB = await repoB.sourceImages.create(projB.id, { ...img, zoneId: zonaB.id });

      // orgA intenta activar una foto del proyecto de orgB conociendo los ids: no-op.
      const changed = await repoA.sourceImages.setActive(projB.id, zonaB.id, fotoB.id);
      expect(changed).toBe(false);
      // La foto de B sigue intacta (PRIMARY por creación).
      expect(await repoB.sourceImages.latestPrimary(projB.id, zonaB.id)).toMatchObject({
        id: fotoB.id,
      });
    });
  });

  describe('zones (multi-zona)', () => {
    it('create de una zona en un proyecto ajeno lanza (anti-IDOR)', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });

      await expect(
        withOrg(ctx(orgA)).zones.create(projB.id, { name: 'Cocina' }),
      ).rejects.toThrow();
    });

    it('list solo devuelve zonas de la organización del contexto', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });
      await withOrg(ctx(orgA)).zones.create(projA.id, { name: 'Cocina' });
      await withOrg(ctx(orgB)).zones.create(projB.id, { name: 'Salón' });

      expect(await withOrg(ctx(orgA)).zones.list(projA.id)).toHaveLength(1);
      expect(await withOrg(ctx(orgA)).zones.list(projB.id)).toHaveLength(0);
    });

    it('remove de otra org es no-op (no borra la zona ajena)', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });
      const zoneB = await withOrg(ctx(orgB)).zones.create(projB.id, { name: 'Cocina' });

      await withOrg(ctx(orgA)).zones.remove(projB.id, zoneB.id); // no debe afectar a B
      expect(await withOrg(ctx(orgB)).zones.list(projB.id)).toHaveLength(1);
    });

    it('remove (de la propia org) es SOFT: la zona sale de la lista pero conserva su plano', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const zone = await withOrg(ctx(orgA)).zones.create(projA.id, { name: 'Cocina' });
      await withOrg(ctx(orgA)).canvas.save(projA.id, { x: 1 }, zone.id);

      await withOrg(ctx(orgA)).zones.remove(projA.id, zone.id);
      // Sale de la lista de zonas vivas y aparece en la papelera; su plano sigue (recuperable).
      expect(await withOrg(ctx(orgA)).zones.list(projA.id)).toHaveLength(0);
      expect(await withOrg(ctx(orgA)).zones.listDeleted(projA.id)).toHaveLength(1);
      expect(await withOrg(ctx(orgA)).canvas.load(projA.id, zone.id)).toEqual({ x: 1 });
    });

    it('restore devuelve una zona borrada a la lista', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const zone = await withOrg(ctx(orgA)).zones.create(projA.id, { name: 'Cocina' });

      await withOrg(ctx(orgA)).zones.remove(projA.id, zone.id);
      await withOrg(ctx(orgA)).zones.restore(projA.id, zone.id);
      expect(await withOrg(ctx(orgA)).zones.list(projA.id)).toHaveLength(1);
      expect(await withOrg(ctx(orgA)).zones.listDeleted(projA.id)).toHaveLength(0);
    });

    it('purge (de la propia org) hard-borra la zona y su plano por cascade', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const zone = await withOrg(ctx(orgA)).zones.create(projA.id, { name: 'Cocina' });
      await withOrg(ctx(orgA)).canvas.save(projA.id, { x: 1 }, zone.id);

      await withOrg(ctx(orgA)).zones.remove(projA.id, zone.id);
      await withOrg(ctx(orgA)).zones.purge(projA.id, zone.id);
      expect(await withOrg(ctx(orgA)).zones.listDeleted(projA.id)).toHaveLength(0);
      // El plano de la zona se fue por Cascade (no queda huérfano).
      expect(await withOrg(ctx(orgA)).canvas.load(projA.id, zone.id)).toBeNull();
    });

    it('restore de otra org es no-op (no recupera la zona ajena)', async () => {
      const orgA = await makeOrg();
      const orgB = await makeOrg();
      const projB = await withOrg(ctx(orgB)).projects.create({ title: 'B' });
      const zoneB = await withOrg(ctx(orgB)).zones.create(projB.id, { name: 'Cocina' });
      await withOrg(ctx(orgB)).zones.remove(projB.id, zoneB.id);

      await withOrg(ctx(orgA)).zones.restore(projB.id, zoneB.id); // no debe afectar a B
      expect(await withOrg(ctx(orgB)).zones.list(projB.id)).toHaveLength(0);
      expect(await withOrg(ctx(orgB)).zones.listDeleted(projB.id)).toHaveLength(1);
    });
  });

  describe('canvas por zona', () => {
    it('guarda y lee planos distintos para el default y para una zona', async () => {
      const orgA = await makeOrg();
      const projA = await withOrg(ctx(orgA)).projects.create({ title: 'A' });
      const zone = await withOrg(ctx(orgA)).zones.create(projA.id, { name: 'Cocina' });

      await withOrg(ctx(orgA)).canvas.save(projA.id, { a: 1 });
      await withOrg(ctx(orgA)).canvas.save(projA.id, { b: 2 }, zone.id);

      expect(await withOrg(ctx(orgA)).canvas.load(projA.id)).toEqual({ a: 1 });
      expect(await withOrg(ctx(orgA)).canvas.load(projA.id, zone.id)).toEqual({ b: 2 });
    });
  });
});
