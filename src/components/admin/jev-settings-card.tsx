/**
 * Jev (TypeSafe) en Ajustes de sistema: qué hace, por qué la plataforma necesita su clave, dónde conseguirla y el
 * formulario para guardarla. Es la única clave de IA que paga Habiteka; las de generación son de cada organización.
 */
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TypesafeProviderForm } from './typesafe-provider-form';

export function JevSettingsCard({ configured, enabled, keyHint }: { configured: boolean; enabled: boolean; keyHint: string | null }) {
  return (
    <Card className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 text-sm">
        <h2 className="text-ink flex items-center gap-2 text-base font-semibold"><ShieldCheck size={16} aria-hidden />Calidad de las generaciones: Jev (TypeSafe)</h2>
        <p className="text-ink-soft"><strong className="text-ink">Qué hace.</strong> Antes de que una organización gaste en una imagen, un plano o una memoria, Jev comprueba si el plano o la petición son fiables y decide si se sigue, si se pide confirmación o si se frena. Después puntúa el resultado de 0 a 100. No genera contenido.</p>
        <p className="text-ink-soft"><strong className="text-ink">Por qué la necesita la plataforma.</strong> Evita que los usuarios paguen a su proveedor generaciones que saldrían mal. Su coste lo asume Habiteka con esta clave, no las organizaciones: es la única clave de IA que guarda la plataforma. Sin ella, o desactivada, las comprobaciones no se hacen y se genera sin ese filtro.</p>
        <p className="text-ink-soft"><strong className="text-ink">Dónde conseguir la clave.</strong> En la consola oficial de TypeSafe, en el apartado de claves de API. TypeSafe publica un precio de 42 USD por cada mil millones de tokens de entrada. Algunos intermediarios, como OpenRouter, también lo ofrecen, pero Habiteka llama directamente a la API de TypeSafe: aquí solo sirve una clave de TypeSafe.</p>
        <div className="flex flex-wrap gap-4">
          <a href="https://console.typesafe.ai/" target="_blank" rel="noopener noreferrer" className="text-brand-700 inline-flex items-center gap-1 font-medium hover:underline">Consola de TypeSafe<ExternalLink size={14} aria-hidden /></a>
          <a href="https://docs.typesafe.ai/introduction" target="_blank" rel="noopener noreferrer" className="text-brand-700 inline-flex items-center gap-1 font-medium hover:underline">Documentación<ExternalLink size={14} aria-hidden /></a>
        </div>
        <p className="text-ink-soft text-xs">La clave se cifra al guardarla y no se vuelve a mostrar. Los umbrales de decisión se ajustan justo debajo.</p>
      </div>
      <TypesafeProviderForm configured={configured} enabled={enabled} keyHint={keyHint} />
    </Card>
  );
}
