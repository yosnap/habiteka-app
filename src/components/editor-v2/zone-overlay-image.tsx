'use client';

/** Muestra únicamente los píxeles de la zona que llegará a la generación. */
export function ZoneOverlayImage({ src, maskSrc, alt, className }: {
  src: string; maskSrc?: string; alt: string; className?: string;
}) {
  return (
    <span className="block bg-[#ececec]">
      <img src={src} alt={alt} className={className} style={maskSrc ? {
        maskImage: `url(${maskSrc})`, WebkitMaskImage: `url(${maskSrc})`,
        maskMode: 'luminance', maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
      } : undefined} />
    </span>
  );
}

export default ZoneOverlayImage;
