/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', process.env.NEXT_PUBLIC_APP_URL ?? ''],
    },
  },
  // Don't download Google Fonts at build time
  optimizeFonts: false,
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
