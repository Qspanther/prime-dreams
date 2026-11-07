import type { NextConfig } from "next";

let rawBackendUrl = (process.env.BACKEND_URL || '').trim();

if (!rawBackendUrl) {
  rawBackendUrl = process.env.NODE_ENV === 'production'
    ? 'https://prime-dreems-backend.onrender.com'
    : 'http://127.0.0.1:5000';
} else if (!rawBackendUrl.startsWith('http://') && !rawBackendUrl.startsWith('https://')) {
  rawBackendUrl = `http://${rawBackendUrl}`;
}

const backendUrl = rawBackendUrl.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    '*.trycloudflare.com',
    'localhost:3000',
    '127.0.0.1:3000',
    'localhost:3001',
    '127.0.0.1:3001',
  ],
  async rewrites() {
    return [
      {
        source: '/api-backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
