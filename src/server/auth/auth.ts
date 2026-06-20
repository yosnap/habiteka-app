/**
 * Configuración de autenticación (Better Auth).
 *
 * Tres métodos de acceso: email+password (con verificación), email-OTP sin
 * contraseña, y OAuth social (Google + Meta). El captcha protege solo los flujos
 * no-OAuth (el proveedor social ya es la barrera anti-bot). Al crear un usuario
 * se aprovisiona su organización implícita y el cupo de bienvenida.
 *
 * Todos los secretos (DB, OAuth, captcha, email) son server-only.
 */
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, admin, emailOTP, captcha } from 'better-auth/plugins';
import { prisma } from '@/server/db/prisma';
import { getEmailSender } from './send-email';
import { provisionOrganization } from './provision-organization';

const otpSubjects: Record<string, string> = {
  'sign-in': 'Tu código de acceso a Habiteka',
  'email-verification': 'Verifica tu email en Habiteka',
  'forget-password': 'Restablece tu contraseña de Habiteka',
};

function buildPlugins(): BetterAuthPlugin[] {
  const plugins: BetterAuthPlugin[] = [
    organization(),
    admin(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await getEmailSender().send({
          to: email,
          subject: otpSubjects[type] ?? 'Tu código de Habiteka',
          body: `Tu código es: ${otp}`,
        });
      },
    }),
  ];

  // El captcha solo se monta si hay clave configurada; en su ausencia (tests,
  // arranque local) la app sigue funcionando sin él.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    plugins.push(
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: turnstileSecret,
        // OAuth queda fuera: el proveedor social es la barrera anti-bot.
        endpoints: ['/sign-up/email', '/sign-in/email', '/email-otp/send-verification-otp'],
      }),
    );
  }

  return plugins;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID ?? '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? '',
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Tras crear el usuario, se aprovisiona su organización + cupo de
        // bienvenida. La operación es idempotente, así que es robusta ante
        // reintentos o registros sociales que completan verificación después.
        after: async (user) => {
          await provisionOrganization({
            userId: user.id,
            userName: user.name,
            email: user.email,
          });
        },
      },
    },
  },
  plugins: buildPlugins(),
});
