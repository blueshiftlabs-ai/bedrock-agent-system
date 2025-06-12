/** @type {import('next').NextConfig} */
const nextConfig = {
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