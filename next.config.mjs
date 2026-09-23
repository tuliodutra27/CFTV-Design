/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config) => {
    // konva/lib/index-node.js (build Node do konva) exige o pacote nativo `canvas`,
    // usado só para renderização server-side — não usamos isso (CctvCanvas é ssr:false).
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
