/**
 * Ajustes de sistema: feature flags y parámetros anti-abuso editables sin
 * redeploy (cupo de bienvenida, iteraciones gratis por entregable, límite por
 * origen, cap global). F2 y la facturación leen el valor actual en cada decisión.
 */
import { adminListSystemSettings } from '@/server/admin/config/actions';

export default async function SystemPage() {
  const settings = await adminListSystemSettings();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Ajustes de sistema</h1>
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
