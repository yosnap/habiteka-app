'use client';

/**
 * Panel de acceso: email+password (con captcha si aplica) y proveedores sociales.
 * Tras un login correcto, redirige a "mis proyectos".
 */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { EmailPasswordForm, type AuthSubmit } from './email-password-form';
import { SocialButtons } from './social-buttons';
import { TurnstileProvider } from './turnstile-widget';
import { signIn } from '@/lib/auth-client';
import { translateAuthError } from './auth-errors';

export function AccesoPanel() {
  const router = useRouter();

  async function onSubmit(values: AuthSubmit) {
    const res = await signIn.email(
      { email: values.email, password: values.password },
      values.captchaToken ? { headers: { 'x-captcha-response': values.captchaToken } } : undefined,
    );
    if (res.error) return { error: translateAuthError(res.error.code, res.error.message) };
    router.push('/proyectos');
  }

  return (
    <TurnstileProvider>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Acceder</CardTitle>
          <CardDescription>Entra para seguir con tus proyectos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EmailPasswordForm mode="acceso" onSubmit={onSubmit} />
          <div className="flex items-center gap-3">
            <span className="bg-line h-px flex-1" />
            <span className="text-ink-soft text-xs">o</span>
            <span className="bg-line h-px flex-1" />
          </div>
          <SocialButtons />
          <p className="text-ink-soft text-center text-xs">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="text-brand-700 underline">
              Crea una
            </Link>
          </p>
        </CardContent>
      </Card>
    </TurnstileProvider>
  );
}
