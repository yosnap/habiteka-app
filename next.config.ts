import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Servidor autónomo para el contenedor: Next emite `.next/standalone` con un
  // `server.js` que Node ejecuta sin el árbol completo de node_modules. Es lo
  // que arranca la imagen Docker que construye Dokploy.
  output: 'standalone',
  // 10 MB de imagen ocupan ~13,4 MB al codificarse como base64.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  // El chequeo de tipos de `next build` sin caché necesita varios GB de RAM y
  // ahoga al VPS que construye la imagen. CI ya ejecuta `tsc --noEmit` como
  // puerta antes de mergear, así que el build de la imagen (y solo ese, vía la
  // variable que fija el Dockerfile) lo omite. En local `bun run build` sigue
  // comprobando tipos.
  typescript: { ignoreBuildErrors: process.env.NEXT_SKIP_TYPECHECK === '1' },
};

export default nextConfig;
