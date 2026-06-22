/**
 * Visor del render 3D: muestra la imagen generada por el proveedor. La URL
 * proviene del entregable (asset propio servido por la plataforma), no de una
 * URL arbitraria del usuario.
 */
import { LegalSeal } from './legal-seal';
import { UseAsBackgroundButton } from './use-as-background-button';

export function Render3dViewer({
  assetUrl,
  projectId,
  zoneId = null,
}: {
  assetUrl: string;
  projectId: string;
  /** Zona que originó el diseño; el fondo se aplica a su plano (null = por defecto). */
  zoneId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-surface-muted relative aspect-video w-full overflow-hidden rounded-card">
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
      {/* Cierra el ciclo IA → editor: trae el render al plano de su zona como fondo. */}
      <UseAsBackgroundButton projectId={projectId} assetUrl={assetUrl} zoneId={zoneId} />
    </div>
  );
}
