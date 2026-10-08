import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
export interface WalkthroughUploadTicket {
  id: string; key: string; organizationId: string; userId: string; projectId: string;
  zoneId: string | null; routeId: string; approvalId: string; approvedRevision: number;
  approvedFingerprint: string; bytes: number; durationMs: number; mode?: NativeVideoMode | 'images' | 'advertising' | 'property-visit-ai'; expires: number;
  jobVersion?: number;
  /** Montaje con imágenes: renders que lo componen, en orden. */
  sourceIds?: string[];
  contentScope?: import('@/lib/editor-document/video-content-scope').VideoContentScope;
  presentation?: import('@/lib/editor-document/video-presentation').VideoPresentationOptions;
  advertising?: import('@/lib/editor-document/advertising-video').AdvertisingVideoOptions;
  title?: string;
}
function signature(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('base64url'); }
export function signUploadTicket(ticket: WalkthroughUploadTicket, secret: string): string {
  const value = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${value}.${signature(value, secret)}`;
}
export function readUploadTicket(value: string, secret: string, now = Date.now()): WalkthroughUploadTicket {
  // El guion admite 2000 caracteres Unicode; su JSON/base64 puede superar 8000 bytes.
  if (typeof value !== 'string' || value.length > 24000) throw new Error('Permiso de subida inválido');
  const [payload, signed, extra] = value.split('.');
  if (!payload || !signed || extra) throw new Error('Permiso de subida inválido');
  const actual = Buffer.from(signed), expected = Buffer.from(signature(payload, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Permiso de subida inválido');
  const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString()) as WalkthroughUploadTicket;
  if (!Number.isFinite(ticket.expires) || ticket.expires < now) throw new Error('La subida ha caducado. Vuelve a exportar.');
  if (typeof ticket.approvalId !== 'string' || !ticket.approvalId ||
    !Number.isSafeInteger(ticket.approvedRevision) || ticket.approvedRevision < 0 ||
    typeof ticket.approvedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(ticket.approvedFingerprint))
    throw new Error('El vídeo debe pertenecer a un diseño aprobado.');
  return ticket;
}
export function assertVideoUpload(bytes: number, expected: number, contentType: string, header: Uint8Array) {
  if (bytes !== expected || bytes < 32 || bytes > 100 * 1024 * 1024 || contentType !== 'video/mp4' ||
    Buffer.from(header).subarray(4, 8).toString() !== 'ftyp') throw new Error('El objeto subido no es el MP4 esperado');
}
