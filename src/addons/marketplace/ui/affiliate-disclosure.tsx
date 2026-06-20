/**
 * Divulgación de afiliación obligatoria (compliance Amazon Associates / Ikea).
 * Acompaña siempre al catálogo y no es ocultable: informa al usuario de que los
 * enlaces son de afiliación.
 */
export function AffiliateDisclosure() {
  return (
    <p className="text-muted-foreground text-xs" role="note">
      Algunos enlaces son de afiliación: Habiteka puede recibir una comisión por las compras
      realizadas, sin coste adicional para ti.
    </p>
  );
}
