import Image from 'next/image';

/**
 * Lyra Enterprises wordmark — gradient gold on the "Lyra" word.
 * Optional `withLogo` prefixes the actual logo image.
 */
export function BrandWordmark({
  size = 'md',
  className = '',
  withLogo = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  withLogo?: boolean;
}) {
  const cls = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-4xl sm:text-5xl',
  }[size];

  const logoPx = { sm: 24, md: 32, lg: 56 }[size];

  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${cls} ${className}`}>
      {withLogo && (
        <Image
          src="/logo.png"
          alt="Lyra Enterprises logo"
          width={logoPx}
          height={logoPx}
          className="object-contain"
          priority
        />
      )}
      <span>
        <span className="bg-gradient-to-br from-lyra-soft via-lyra-orchid to-lyra-magenta bg-clip-text text-transparent">
          Lyra
        </span>{' '}
        <span className="text-white/90">Enterprises</span>
      </span>
    </span>
  );
}

/**
 * Brand logo image — circular, used as a header/nav avatar.
 * Replaces the previous gradient "L" monogram.
 */
export function BrandMonogram({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full overflow-hidden ring-1 ring-white/10 bg-black/40 shadow-glow-amber"
      style={{ width: size, height: size }}
      aria-label="Lyra Enterprises"
    >
      <Image
        src="/logo.png"
        alt="Lyra Enterprises"
        fill
        sizes={`${size}px`}
        className="object-contain p-1"
        priority
      />
    </div>
  );
}

/**
 * Standalone logo image (no circular frame) — for hero/login screens.
 */
export function BrandLogo({
  size = 80,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Lyra Enterprises"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
