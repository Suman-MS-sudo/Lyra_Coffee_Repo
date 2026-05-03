import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lyra Enterprises brand palette — Gold & Black edition.
        // Class names retain `coffee-*` for backward compatibility.
        coffee: {
          50:  '#fdf8ec',
          100: '#faeec8',
          200: '#f5dd8d',
          300: '#eecb5e',
          400: '#e0b13a',
          500: '#D4A24A',  // primary brand gold
          600: '#b88528',
          700: '#8C6A1F',
          800: '#6b4f17',
          900: '#4a360e',
          950: '#241a05',
        },
        // Lyra brand tokens — gold variants
        lyra: {
          pink:    '#E8B547',  // CTA / highlight (was pink → now bright gold)
          magenta: '#D4A24A',  // primary
          purple:  '#8C6A1F',  // deep bronze
          orchid:  '#C9954A',  // mid antique gold
          soft:    '#F0D58C',  // light champagne
        },
        // Neutral cream tones
        cream: {
          50:  '#fefdfb',
          100: '#faf7f2',
          200: '#f2ebe0',
          300: '#e5d9c9',
          400: '#cfc0a8',
          500: '#b5a390',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)',    'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia',   'serif'],
      },
      animation: {
        'fade-in':       'fadeIn .35s ease forwards',
        'slide-up':      'slideUp .4s cubic-bezier(.22,.68,0,1.2) forwards',
        'slide-down':    'slideDown .35s ease forwards',
        'scale-in':      'scaleIn .3s cubic-bezier(.22,.68,0,1.2) forwards',
        'shimmer':       'shimmer 1.6s infinite linear',
        'spin-slow':     'spin 3s linear infinite',
        'pulse-subtle':  'pulseSubtle 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' },                         to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown:    { from: { opacity: '0', transform: 'translateY(-16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(.93)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:      { from: { backgroundPosition: '-200% 0' },        to: { backgroundPosition: '200% 0' } },
        pulseSubtle:  { '0%,100%': { opacity: '1' },                    '50%': { opacity: '.65' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glass': '0 4px 32px 0 rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.08)',
        // Brand glow — gold (kept the `glow-amber` name for compatibility)
        'glow-amber': '0 0 24px 4px rgba(212,162,74,.45)',
        'glow-pink':  '0 0 24px 4px rgba(232,181,71,.45)',
        'card': '0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
};

export default config;
