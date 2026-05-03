import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin } from 'lucide-react';
import { BrandLogo } from './BrandWordmark';

const PHONE_DISPLAY = '+91-81223 78860';
const PHONE_TEL     = 'tel:+918122378860';
const EMAIL         = 'sales@lyraenterprise.co.in';
const ADDRESS       =
  '10/21, Vasuki Street, Cholapuram, Ambattur, Chennai – 600053';
const MAP_URL =
  'https://maps.google.com/maps?q=10/21,+Vasuki+Street,+Cholapuram,+Ambattur,+Chennai+600053,+India';

const SOCIALS = [
  { href: 'https://www.facebook.com/profile.php?id=61578649496806', label: 'Facebook',  Icon: Facebook  },
  { href: 'https://www.instagram.com/lyraenterprises_/',             label: 'Instagram', Icon: Instagram },
  { href: 'https://www.linkedin.com/company/lyra-enterprises/',      label: 'LinkedIn',  Icon: Linkedin  },
];

/**
 * Full brand footer — used on the landing page.
 */
export function BrandFooter() {
  return (
    <footer className="border-t border-white/5 bg-black/40">
      <div className="max-w-5xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BrandLogo size={40} />
            <p className="text-white font-semibold text-base">Lyra Enterprises</p>
          </div>
          <p className="text-white/40 text-xs mt-2 leading-relaxed">
            Smart vending machines for authentic South Indian filter coffee &amp; freshly brewed tea.
            Hot beverages on demand for offices, campuses and public spaces.
          </p>
          <div className="flex gap-3 mt-4">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-coffee-500/40 hover:text-coffee-400 text-white/60 transition-colors"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <p className="text-white/80 font-medium text-xs uppercase tracking-widest mb-3">
            Contact
          </p>
          <ul className="space-y-2 text-white/60">
            <li>
              <a href={PHONE_TEL} className="flex items-center gap-2 hover:text-coffee-400 transition-colors">
                <Phone size={14} className="text-coffee-400" />
                {PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 hover:text-coffee-400 transition-colors break-all">
                <Mail size={14} className="text-coffee-400" />
                {EMAIL}
              </a>
            </li>
            <li>
              <a
                href={MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:text-coffee-400 transition-colors"
              >
                <MapPin size={14} className="text-coffee-400 mt-0.5 shrink-0" />
                <span>{ADDRESS}</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div>
          <p className="text-white/80 font-medium text-xs uppercase tracking-widest mb-3">
            Lyra Enterprises
          </p>
          <ul className="space-y-2 text-white/60">
            <li><a href="https://lyraenterprise.co.in" target="_blank" rel="noopener noreferrer" className="hover:text-coffee-400 transition-colors">Main website</a></li>
            <li><a href="https://lyraenterprise.co.in/products/sanitary-napkin-vending-machines" target="_blank" rel="noopener noreferrer" className="hover:text-coffee-400 transition-colors">Vending Machines</a></li>
            <li><a href="https://lyraenterprise.co.in/products/sanitary-napkin-incinerators" target="_blank" rel="noopener noreferrer" className="hover:text-coffee-400 transition-colors">Incinerators</a></li>
            <li><a href="https://lyraenterprise.co.in/contact" target="_blank" rel="noopener noreferrer" className="hover:text-coffee-400 transition-colors">Contact / Support</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/30">
          <p>© {new Date().getFullYear()} Lyra Enterprises. All rights reserved.</p>
          <p>Made in Chennai, India.</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Compact footer — used on narrow screens (e.g. machine order flow).
 * Shows essential contact + socials only.
 */
export function BrandFooterCompact() {
  return (
    <footer className="mt-8 border-t border-white/5 bg-black/30">
      <div className="px-5 py-6 text-center">
        <div className="flex justify-center mb-2">
          <BrandLogo size={36} />
        </div>
        <p className="text-white text-sm font-semibold">Lyra Enterprises</p>
        <p className="text-white/30 text-[11px] mt-0.5 uppercase tracking-widest">
          #1 Vending Machine Manufacturer · India
        </p>

        <div className="mt-4 flex flex-col gap-1.5 text-xs text-white/60">
          <a href={PHONE_TEL} className="flex items-center justify-center gap-2 hover:text-coffee-400 transition-colors">
            <Phone size={12} className="text-coffee-400" />
            {PHONE_DISPLAY}
          </a>
          <a href={`mailto:${EMAIL}`} className="flex items-center justify-center gap-2 hover:text-coffee-400 transition-colors break-all">
            <Mail size={12} className="text-coffee-400" />
            {EMAIL}
          </a>
        </div>

        <div className="flex justify-center gap-3 mt-4">
          {SOCIALS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:border-coffee-500/40 hover:text-coffee-400 text-white/60 transition-colors"
            >
              <Icon size={13} />
            </a>
          ))}
        </div>

        <p className="text-[10px] text-white/25 mt-5">
          © {new Date().getFullYear()} Lyra Enterprises · Made in Chennai, India.
        </p>
      </div>
    </footer>
  );
}
