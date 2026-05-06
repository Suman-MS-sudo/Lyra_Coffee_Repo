import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'About Us — Lyra Enterprises',
  description:
    'Lyra Enterprises is a Chennai-based manufacturer of smart vending ' +
    'machines for authentic South Indian filter coffee and tea.',
};

export default function AboutPage() {
  return (
    <LegalShell title="About Us" lastUpdated="6 May 2026">
      <p>
        <strong>Lyra Enterprises</strong> is a Chennai-based manufacturer and
        operator of smart beverage vending machines. We design, build and
        maintain machines that dispense authentic South Indian filter coffee
        and freshly brewed tea on demand, for offices, campuses, hospitals
        and public spaces across India.
      </p>

      <h2>What we do</h2>
      <p>
        Each Lyra machine is connected to our cloud platform. Customers scan
        a QR code printed on the machine, customise their drink (strength,
        with or without milk) and pay instantly through UPI. The machine
        brews and dispenses the drink within seconds.
      </p>

      <h2>Why Lyra</h2>
      <ul>
        <li>Genuine filter coffee decoction — no instant powders.</li>
        <li>Cashless ordering via UPI / Razorpay.</li>
        <li>Live machine health monitoring and remote support.</li>
        <li>Designed and assembled in Chennai, India.</li>
      </ul>

      <h2>Registered office</h2>
      <p>
        Lyra Enterprises<br />
        10/21, Vasuki Street, Cholapuram,<br />
        Ambattur, Chennai – 600053,<br />
        Tamil Nadu, India.
      </p>

      <h2>Get in touch</h2>
      <p>
        For sales, service or partnership enquiries, see our{' '}
        <a href="/contact">Contact</a> page or visit{' '}
        <a href="https://lyraenterprise.co.in" target="_blank" rel="noopener noreferrer">
          lyraenterprise.co.in
        </a>
        .
      </p>
    </LegalShell>
  );
}
