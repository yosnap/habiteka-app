import { describe, expect, it } from 'vitest';
import { runAction, fail } from '@/server/errors/run-action';
import { UserFacingError } from '@/server/errors/user-facing-error';
import { callAction, isActionError } from '@/lib/action-result';
import { RenderRejectedError } from '@/server/errors/render-rejected-error';

describe('runAction / callAction', () => {
  it('conserva el código de rechazo al atravesar la Server Action', async () => {
    const result = await runAction(async () => { throw new RenderRejectedError('Imagen rechazada'); });
    expect(result).toEqual({ actionError: 'Imagen rechazada', code: 'render_rejected' });
    await expect(callAction(Promise.resolve(result))).rejects.toMatchObject({ code: 'render_rejected' });
  });
  it('devuelve el valor tal cual cuando la acción resuelve sin errores', async () => {
    const result = await runAction(async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it('convierte un UserFacingError en un valor de retorno { actionError }', async () => {
    const result = await runAction(async () => {
      fail('Falta el consentimiento.');
    });
    expect(isActionError(result)).toBe(true);
    expect(result).toEqual({ actionError: 'Falta el consentimiento.' });
  });

  it('relanza un error que NO es UserFacingError (fallo inesperado)', async () => {
    await expect(
      runAction(async () => {
        throw new Error('fallo de red inesperado');
      }),
    ).rejects.toThrow('fallo de red inesperado');
  });

  it('callAction relanza como Error normal el actionError devuelto por el servidor', async () => {
    const serverResult = Promise.resolve({ actionError: 'Debes aceptar los Términos de Servicio.' });
    await expect(callAction(serverResult)).rejects.toThrow(
      'Debes aceptar los Términos de Servicio.',
    );
  });

  it('callAction devuelve el dato tal cual cuando no hay error', async () => {
    const serverResult = Promise.resolve({ imageUrl: 'https://example.com/a.png' });
    await expect(callAction(serverResult)).resolves.toEqual({
      imageUrl: 'https://example.com/a.png',
    });
  });

  it('una subclase de UserFacingError (p. ej. un error de dominio) también se captura', async () => {
    class DomainError extends UserFacingError {}
    const result = await runAction(async () => {
      throw new DomainError('Saldo insuficiente.');
    });
    expect(result).toEqual({ actionError: 'Saldo insuficiente.' });
  });
});
