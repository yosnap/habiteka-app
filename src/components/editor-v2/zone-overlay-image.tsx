'use client';

/**
 * Vista de referencia con la zona permitida teñida encima. La máscara es la
 * misma que usa el servidor para componer, así que lo verde es exactamente lo
 * que se puede diseñar. Solo se muestra: al modelo le llega la captura limpia.
 */
export function ZoneOverlayImage({ src, maskSrc, alt, className }: {
  src: string; maskSrc?: string; alt: string; className?: string;
}) {
  return (
    <span className="relative block">
      <img src={src} alt={alt} className={className} />
      {maskSrc && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: 'rgb(34 197 94 / 0.4)',
            maskImage: `url(${maskSrc})`, WebkitMaskImage: `url(${maskSrc})`,
            maskMode: 'luminance',
            maskSize: 'contain', WebkitMaskSize: 'contain',
            maskPosition: 'center', WebkitMaskPosition: 'center',
            maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
          }}
        />
      )}
    </span>
  );
}

export default ZoneOverlayImage;
