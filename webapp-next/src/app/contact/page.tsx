import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'Contact Us — Lyra Enterprises',
  description:
    'Reach Lyra Enterprises for sales, service, refunds or general support.',
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact Us" lastUpdated="6 May 2026">
      <p>
        We respond to all enquiries within one working day. For issues with a
        specific order or machine, please include the date, time and machine
        location so we can trace the transaction quickly.
      </p>

      <h2>Customer support</h2>
      <ul>
        <li>
          <strong>Email:</strong>{' '}
          <a href="mailto:sales@lyraenterprise.co.in">
            sales@lyraenterprise.co.in
          </a>
        </li>
        <li>
          <strong>Phone / WhatsApp:</strong>{' '}
          <a href="tel:+918122378860">+91-81223 78860</a>
          <br />
          <span className="text-white/50 text-sm">
            Available Monday – Saturday, 10:00 – 19:00 IST.
          </span>
        </li>
      </ul>

      <h2>Registered office</h2>
      <p>
        Lyra Enterprises<br />
        10/21, Vasuki Street, Cholapuram,<br />
        Ambattur, Chennai – 600053,<br />
        Tamil Nadu, India.
      </p>

      <h2>Refunds &amp; payment disputes</h2>
      <p>
        Please email{' '}
        <a href="mailto:sales@lyraenterprise.co.in">sales@lyraenterprise.co.in</a>{' '}
        with the Razorpay payment reference (visible in your bank/UPI app)
        and a short description of the issue. See our{' '}
        <a href="/refund-policy">Refund &amp; Cancellation Policy</a> for the
        full process.
      </p>
    </LegalShell>
  );
}
