/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8001/api/:path*'
      },
      {
        source: '/user-api/:path*',
        destination: 'http://localhost:8000/:path*'
      },
      {
        source: '/ws/:path*',
        destination: 'http://localhost:8001/ws/:path*'
      },
    ];
  },
};

module.exports = nextConfig; 