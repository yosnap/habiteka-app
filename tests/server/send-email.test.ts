import { describe, it, expect } from 'vitest';
import { setEmailSender, getEmailSender, type EmailMessage } from '@/server/auth/send-email';

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
