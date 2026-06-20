/**
 * Vista de facturación: suscripciones sincronizadas desde el proveedor de pagos
 * (solo lectura). Los reembolsos se ejecutan vía la acción que delega en la capa
 * de facturación; aquí se muestra el estado.
 */
import { adminSubscriptions } from '@/server/admin/analytics/actions';

export default async function BillingPage() {
  const { rows, activeCount } = await adminSubscriptions();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Facturación</h1>
      <p className="text-sm">
        Suscripciones activas: <strong>{activeCount}</strong>
      </p>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2">Organización</th>
            <th className="py-2">Plan</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Renueva</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.organizationId} className="border-line border-t">
              <td className="py-2 font-mono text-xs">{s.organizationId}</td>
              <td className="py-2">{s.plan}</td>
              <td className="py-2">{s.status}</td>
              <td className="py-2">{s.currentPeriodEnd?.toISOString().slice(0, 10) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
