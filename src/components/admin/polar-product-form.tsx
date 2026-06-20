'use client';

/**
 * Formulario de creación de un producto de pago en Polar desde el back-office.
 * Recoge nombre, precio e intervalo y dispara la Server Action, que crea el
 * producto en Polar y guarda su id para el checkout. Muestra el id resultante.
 */
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminCreatePolarProduct } from '@/server/admin/config/actions';

export function PolarProductForm() {
  const [name, setName] = useState('Paquete de créditos');
  const [amount, setAmount] = useState('1999');
  const [recurring, setRecurring] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const { productId } = await adminCreatePolarProduct({
          name,
          priceAmount: Number(amount),
          currency: 'usd',
          recurringInterval: recurring ? 'month' : undefined,
          settingKey: recurring ? 'polar_plan_product_id' : 'polar_credits_product_id',
        });
        setResult(productId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear el producto');
      }
    });
  };

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="text-sm">
        Nombre
        <input
          className="border-line bg-surface mt-1 w-full rounded-[var(--radius-control)] border px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="text-sm">
        Precio (céntimos)
        <input
          className="border-line bg-surface mt-1 w-full rounded-[var(--radius-control)] border px-2 py-1"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
        />
        Suscripción mensual (si no, pago único)
      </label>
      <Button type="button" size="sm" onClick={submit} disabled={pending}>
        {pending ? 'Creando…' : 'Crear producto en Polar'}
      </Button>
      {result && <p className="text-sm text-[--color-success]">Creado: {result}</p>}
      {error && <p className="text-sm text-[--color-danger]">{error}</p>}
    </div>
  );
}
