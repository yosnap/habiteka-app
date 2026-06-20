/**
 * Envío de email enchufable (OTP + verificación).
 *
 * La interfaz `EmailSender` desacopla el proveedor concreto, coherente con el
 * patrón de adaptadores del proyecto y con el self-host fair-code: el operador
 * elige Resend (por defecto) o SMTP por configuración, sin tocar el código que
 * envía. Los secretos del proveedor son server-only.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// Implementación Resend (por defecto). Se mantiene mínima: una llamada a su API
// REST, sin SDK, para no acoplar el build a una dependencia extra.
class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend respondió ${res.status}`);
    }
  }
}

// Selecciona el proveedor por entorno. Se resuelve de forma perezosa para que la
// ausencia de credenciales no rompa el arranque ni los tests que no envían email.
let cached: EmailSender | undefined;

export function getEmailSender(): EmailSender {
  if (cached) return cached;

  const provider = process.env.EMAIL_PROVIDER ?? 'resend';
  const from = process.env.EMAIL_FROM ?? 'Habiteka <no-reply@habiteka.app>';

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY no está definida');
    }
    cached = new ResendEmailSender(apiKey, from);
    return cached;
  }

  throw new Error(`EMAIL_PROVIDER no soportado: ${provider}`);
}

/** Permite inyectar un sender (tests) sin tocar la selección por entorno. */
export function setEmailSender(sender: EmailSender): void {
  cached = sender;
}
