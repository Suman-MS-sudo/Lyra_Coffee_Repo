/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', process.env.NEXT_PUBLIC_APP_URL ?? ''],
    },
    // Required for better-sqlite3 (native Node addon) to load in Next.js API routes.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Disable SWC minification — use terser instead, which is more stable on ARM64
  swcMinify: false,
  // Don't download Google Fonts at build time — use browser fallback instead
  optimizeFonts: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // better-sqlite3 is a native addon loaded only at runtime on the Pi.
      // Mark it external so webpack never tries to bundle or resolve it.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        'better-sqlite3',
      ];
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',       value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "frame-src 'self' https://api.razorpay.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
