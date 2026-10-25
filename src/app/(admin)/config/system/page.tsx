/**
 * Ajustes de sistema: Jev (la clave de calidad que paga la plataforma), sus umbrales, feature flags y parámetros anti-abuso editables sin
 * redeploy (cupo de bienvenida, iteraciones gratis por entregable, límite por
 * origen, cap global). F2 y la facturación leen el valor actual en cada decisión.
 */
import { adminGetTypesafeProviderStatus, adminListSystemSettings } from '@/server/admin/config/actions';
import { JevSettingsCard } from '@/components/admin/jev-settings-card';
import { QualityThresholdsForm } from '@/components/admin/quality-thresholds-form';
import { DEFAULT_THRESHOLDS, parseThresholds } from '@/server/quality/scoring';

export default async function SystemPage() {
  const [settings, jev] = await Promise.all([adminListSystemSettings(), adminGetTypesafeProviderStatus()]);
  const thresholds = parseThresholds(settings.find((s) => s.key === 'quality_thresholds')?.value ?? DEFAULT_THRESHOLDS);
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-ink text-xl font-semibold tracking-tight">Ajustes de sistema</h1>
        <p className="text-ink-soft mt-1 max-w-3xl text-sm">Parámetros de toda la plataforma. Los proveedores, claves y modelos de IA de generación no están aquí: cada organización los gestiona en Mi perfil.</p>
      </header>
      <JevSettingsCard configured={jev.configured} enabled={jev.enabled} keyHint={jev.keyHint} />
      <QualityThresholdsForm proceed={thresholds.proceed} confirm={thresholds.confirm} />
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2">Clave</th>
            <th className="py-2">Valor</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((s) => (
            <tr key={s.key} className="border-line border-t">
              <td className="py-2 font-mono text-xs">{s.key}</td>
              <td className="py-2">{JSON.stringify(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
