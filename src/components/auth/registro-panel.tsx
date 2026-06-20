'use client';

/**
 * Panel de registro: email+password (con captcha si aplica) y proveedores
 * sociales. Si el alta exige verificación de correo, se muestra el aviso en lugar
 * de redirigir.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { EmailPasswordForm, type AuthSubmit } from './email-password-form';
import { SocialButtons } from './social-buttons';
import { TurnstileProvider } from './turnstile-widget';
import { signUp } from '@/lib/auth-client';
import { translateAuthError } from './auth-errors';

export function RegistroPanel() {
  const router = useRouter();
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  async function onSubmit(values: AuthSubmit) {
    const res = await signUp.email(
      { email: values.email, password: values.password, name: values.name ?? '' },
      values.captchaToken ? { headers: { 'x-captcha-response': values.captchaToken } } : undefined,
    );
    if (res.error) return { error: translateAuthError(res.error.code, res.error.message) };
    // Con verificación de email obligatoria, el alta no abre sesión (token null).
    if (!res.data?.user?.emailVerified) {
      setVerifyNotice(
        'Te hemos enviado un correo para verificar tu cuenta. Revísalo y luego accede.',
      );
      return;
    }
    router.push('/proyectos');
  }

  if (verifyNotice) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>{verifyNotice}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/acceder" className="text-brand-700 text-sm underline">
            Ir a acceder
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <TurnstileProvider>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>Empieza a diseñar tu espacio en minutos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EmailPasswordForm mode="registro" onSubmit={onSubmit} />
          <Divider />
          <SocialButtons />
          <p className="text-ink-soft text-center text-xs">
            ¿Ya tienes cuenta?{' '}
            <Link href="/acceder" className="text-brand-700 underline">
              Accede
            </Link>
          </p>
        </CardContent>
      </Card>
    </TurnstileProvider>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-line h-px flex-1" />
      <span className="text-ink-soft text-xs">o</span>
      <span className="bg-line h-px flex-1" />
    </div>
  );
}
