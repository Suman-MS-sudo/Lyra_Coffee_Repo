import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent Razorpay and other server-only modules in client bundles
  serverExternalPackages: ['bcryptjs', 'razorpay', 'crypto'],

  // Security headers are set in middleware.ts
  // But add these as a fallback for static routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
