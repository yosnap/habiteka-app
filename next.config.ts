import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Servidor autónomo para el contenedor: Next emite `.next/standalone` con un
  // `server.js` que Node ejecuta sin el árbol completo de node_modules. Es lo
  // que arranca la imagen Docker que construye Easypanel.
  output: 'standalone',
  // 10 MB de imagen ocupan ~13,4 MB al codificarse como base64.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
};

export default nextConfig;
