import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No exponer la versión de Next.js en las cabeceras
  poweredByHeader: false,
  // El lint (con @next/eslint-plugin-next) corre aparte con `pnpm lint` sobre el flat config
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
