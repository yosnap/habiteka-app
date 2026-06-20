/**
 * Gestión de productos de pago: crea paquetes de créditos o planes en Polar
 * directamente desde el panel. El rol admin se valida en el layout y en la acción.
 */
import { requireAdmin } from '@/server/admin/guard';
import { PolarProductForm } from '@/components/admin/polar-product-form';

export default async function ProductsPage() {
  await requireAdmin();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">Productos de pago (Polar)</h1>
      <p className="text-muted-foreground text-sm">
        Crea un paquete de créditos (pago único) o un plan (suscripción). El producto se crea en
        Polar y su identificador se guarda para el checkout.
      </p>
      <PolarProductForm />
    </section>
  );
}
