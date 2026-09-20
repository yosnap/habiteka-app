import { createHmac, timingSafeEqual } from 'node:crypto';
export interface WalkthroughUploadTicket {
  id: string; key: string; organizationId: string; userId: string; projectId: string;
  zoneId: string | null; routeId: string; bytes: number; durationMs: number; expires: number;
}
function signature(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('base64url'); }
export function signUploadTicket(ticket: WalkthroughUploadTicket, secret: string): string {
  const value = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${value}.${signature(value, secret)}`;
}
export function readUploadTicket(value: string, secret: string, now = Date.now()): WalkthroughUploadTicket {
  if (typeof value !== 'string' || value.length > 8000) throw new Error('Permiso de subida inválido');
  const [payload, signed, extra] = value.split('.');
  if (!payload || !signed || extra) throw new Error('Permiso de subida inválido');
  const actual = Buffer.from(signed), expected = Buffer.from(signature(payload, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Permiso de subida inválido');
  const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString()) as WalkthroughUploadTicket;
  if (!Number.isFinite(ticket.expires) || ticket.expires < now) throw new Error('La subida ha caducado. Vuelve a exportar.');
  return ticket;
}
export function assertVideoUpload(bytes: number, expected: number, contentType: string, header: Uint8Array) {
  if (bytes !== expected || bytes < 32 || bytes > 100 * 1024 * 1024 || contentType !== 'video/mp4' ||
    Buffer.from(header).subarray(4, 8).toString() !== 'ftyp') throw new Error('El objeto subido no es el MP4 esperado');
}
