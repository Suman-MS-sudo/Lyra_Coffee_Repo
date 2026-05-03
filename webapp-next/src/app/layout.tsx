import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display:  'swap',
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: false,
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight:  ['400', '500', '600', '700'],
  style:   ['normal', 'italic'],
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title:       'Lyra Enterprises — Filter Coffee & Tea Vending',
  description:
    'Order authentic South Indian filter coffee &amp; freshly brewed tea from your nearest Lyra machine. ' +
    'Manufactured by Lyra Enterprises, Chennai.',
  icons:       {
    icon:    [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple:   '/logo.png',
    shortcut: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#D4A24A',
  width:      'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-[#0a0a0a] text-white antialiased relative">
        {/* Ambient warm aurora background */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-25"
               style={{ background: 'radial-gradient(circle at center, #D4A24A 0%, transparent 65%)' }} />
          <div className="absolute top-[20%] -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-20"
               style={{ background: 'radial-gradient(circle at center, #b8851a 0%, transparent 65%)' }} />
          <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
               style={{ background: 'radial-gradient(circle at center, #8C6A1F 0%, transparent 60%)' }} />
          <div className="absolute inset-0 opacity-[0.025]"
               style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence baseFrequency=%220.9%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>")' }} />
        </div>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{ classNames: { toast: 'font-sans' } }}
        />
      </body>
    </html>
  );
}
