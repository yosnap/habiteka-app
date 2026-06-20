/**
 * Visor del render 3D: muestra la imagen generada por el proveedor. La URL
 * proviene del entregable (asset propio servido por la plataforma), no de una
 * URL arbitraria del usuario.
 */
import { LegalSeal } from './legal-seal';

export function Render3dViewer({ assetUrl }: { assetUrl: string }) {
  return (
    <div className="bg-surface-muted relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)]">
      {/* Asset propio de la plataforma; no se optimiza vía next/image para no
          requerir allowlist de dominios del proveedor en esta fase. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl}
        alt="Render 3D conceptual del espacio"
        className="h-full w-full object-cover"
      />
      <LegalSeal />
    </div>
  );
}
