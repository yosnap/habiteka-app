/**
 * Panel de analítica: uso por acción (tokens e imágenes por separado), usuarios
 * activos y créditos consumidos en los últimos 30 días. Solo lectura sobre la
 * telemetría y el ledger.
 */
import { adminUsageByAction, adminActiveUsers } from '@/server/admin/analytics/actions';

function last30Days() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export default async function AnalyticsPage() {
  const range = last30Days();
  const [usage, users] = await Promise.all([adminUsageByAction(range), adminActiveUsers(range)]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Analítica (últimos 30 días)</h1>
      <p className="text-sm">
        Usuarios activos: <strong>{users}</strong>
      </p>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2">Acción</th>
            <th className="py-2">Unidad</th>
            <th className="py-2">Cantidad</th>
            <th className="py-2">Coste (USD)</th>
            <th className="py-2">Eventos</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((u) => (
            <tr key={`${u.action}-${u.unit}`} className="border-line border-t">
              <td className="py-2">{u.action}</td>
              <td className="py-2">{u.unit}</td>
              <td className="py-2">{u.totalAmount}</td>
              <td className="py-2">{u.totalCostUsd.toFixed(2)}</td>
              <td className="py-2">{u.events}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
