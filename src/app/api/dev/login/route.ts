/**
 * Acceso de desarrollo: inicia sesión como el usuario admin de prueba sin pasar por
 * OAuth ni email, para poder navegar la app en local. Está blindado por dos
 * condiciones que deben cumplirse a la vez —no estar en producción y tener la flag
 * activada—, de modo que NUNCA crea un atajo de acceso en un despliegue real.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { provisionOrganization } from '@/server/auth/provision-organization';
import { recordConsent } from '@/server/privacy/consent-service';
import { acceptTos } from '@/server/legal/tos-acceptance-service';

const DEV_EMAIL = 'admin@habiteka.dev';
const DEV_PASSWORD = 'habiteka-dev-1234';

function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';
}

export async function GET(): Promise<Response> {
  if (!devLoginEnabled()) {
    return NextResponse.json({ error: 'no disponible' }, { status: 404 });
  }

  await ensureDevAdminReady();

  // Inicia sesión por el flujo oficial; las cabeceras de respuesta traen la cookie
  // de sesión que el navegador conservará.
  const response = await auth.api.signInEmail({
    body: { email: DEV_EMAIL, password: DEV_PASSWORD },
    asResponse: true,
  });

  // Redirige a la home ya con la sesión establecida, propagando las cookies.
  const redirect = NextResponse.redirect(
    new URL('/', process.env.BETTER_AUTH_URL ?? 'http://localhost:3040'),
  );
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') redirect.headers.append('set-cookie', value);
  });
  return redirect;
}

async function ensureDevAdminReady() {
  let user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!user) {
    await auth.api.signUpEmail({
      body: {
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        name: 'Admin Dev',
      },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { email: DEV_EMAIL } });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      role: 'admin',
    },
  });

  const member = await prisma.member.findFirst({ where: { userId: user.id }, select: { organizationId: true } });
  const organizationId =
    member?.organizationId ??
    (await provisionOrganization({ userId: user.id, userName: user.name ?? 'Admin Dev', email: user.email })).organizationId;

  await prisma.creditBalance.upsert({
    where: { organizationId },
    update: { balance: 1000 },
    create: { organizationId, balance: 1000 },
  });

  const hasImageConsent = await prisma.consentRecord.findFirst({
    where: { userId: user.id, purpose: 'IMAGE_PROCESSING' },
  });
  if (!hasImageConsent) {
    await recordConsent({
      userId: user.id,
      organizationId,
      purpose: 'IMAGE_PROCESSING',
      policyVersion: '2026-06',
      granted: true,
    });
  }

  const hasTos = await prisma.tosAcceptance.findFirst({ where: { userId: user.id } });
  if (!hasTos) await acceptTos(user.id);
}
