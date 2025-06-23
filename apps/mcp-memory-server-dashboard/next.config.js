/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: PPR requires Next.js canary
  // experimental: {
  //   ppr: 'incremental',
  // },
  async rewrites() {
    return [
      {
        source: '/api/memory/:path*',
        destination: 'http://localhost:4100/memory/:path*',
      },
    ];
  },
};

module.exports = nextConfig;