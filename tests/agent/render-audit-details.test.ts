import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderAuditDetails, renderIdentityDetails } from '@/server/agent/editor-v2/render-audit-details';

describe('detalle de auditoría cenital', () => {
  it('conserva detalle de interiores panorámicos sin inventar píxeles', async () => {
    const base64 = (await sharp({ create: { width: 2048, height: 866, channels: 3, background: '#ab1234' } }).png().toBuffer()).toString('base64');
    const details = await renderIdentityDetails({ base64, mimeType: 'image/png' });
    expect(details).toHaveLength(4);
    expect(await sharp(Buffer.from(details[0]!.base64, 'base64')).metadata()).toMatchObject({ width: 1147, height: 485 });
  });
  it('extrae cuatro ampliaciones solapadas sin deformar ni ampliar píxeles', async () => {
    const base64 = (await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#ab1234' } }).png().toBuffer()).toString('base64');
    const details = await renderAuditDetails({ base64, mimeType: 'image/png' }, 'top');
    expect(details).toHaveLength(4);
    for (const item of details) expect(await sharp(Buffer.from(item.base64, 'base64')).metadata()).toMatchObject({ width: 1280, height: 640 });
    expect(await renderAuditDetails({ base64, mimeType: 'image/png' }, 'front')).toEqual([]);
  });
});
