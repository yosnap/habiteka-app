/**
 * Configuración del mapeo acción→modelo de IA. Muestra la configuración actual que
 * la capa de IA lee en runtime; la edición valida contra la allowlist y techo de
 * precio antes de persistir, e invalida la caché para aplicar el cambio sin redeploy.
 */
import { adminListModelConfig } from '@/server/admin/config/actions';

export default async function ModelsPage() {
  const configs = await adminListModelConfig();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Modelos de IA por acción</h1>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2">Acción</th>
            <th className="py-2">Modelo primario</th>
            <th className="py-2">Respaldos</th>
            <th className="py-2">Activo</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c.action} className="border-line border-t">
              <td className="py-2">{c.action}</td>
              <td className="py-2 font-mono text-xs">{c.primaryModel}</td>
              <td className="py-2 font-mono text-xs">{c.fallbacks.join(', ') || '—'}</td>
              <td className="py-2">{c.enabled ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
