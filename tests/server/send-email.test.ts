import { afterEach, describe, it, expect } from 'vitest';
import {
  setEmailSender,
  getEmailSender,
  isEmailSendingConfigured,
  type EmailMessage,
} from '@/server/auth/send-email';

describe('EmailSender enchufable', () => {
  it('permite inyectar un sender de prueba y lo usa', async () => {
    const sent: EmailMessage[] = [];
    setEmailSender({
      async send(message) {
        sent.push(message);
      },
    });

    await getEmailSender().send({ to: 'a@b.c', subject: 'OTP', body: 'código: 123456' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('a@b.c');
    expect(sent[0]?.body).toContain('123456');
  });
});

describe('isEmailSendingConfigured', () => {
  const original = { provider: process.env.EMAIL_PROVIDER, key: process.env.RESEND_API_KEY };

  afterEach(() => {
    if (original.provider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = original.provider;
    if (original.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original.key;
  });

  it('false sin RESEND_API_KEY (proveedor por defecto)', () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    expect(isEmailSendingConfigured()).toBe(false);
  });

  it('true con RESEND_API_KEY puesta', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_123';
    expect(isEmailSendingConfigured()).toBe(true);
  });

  it('false para un proveedor no soportado', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.RESEND_API_KEY = 're_test_123';
    expect(isEmailSendingConfigured()).toBe(false);
  });
});
