import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No exponer la versión de Next.js en las cabeceras
  poweredByHeader: false,
  // El lint (con @next/eslint-plugin-next) corre aparte con `pnpm lint` sobre el flat config
  eslint: { ignoreDuringBuilds: true },
  // /admin/importar sube la plantilla .xlsx (hasta 5 MB) en una Server Action; el límite por
  // defecto es 1 MB
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default nextConfig;
