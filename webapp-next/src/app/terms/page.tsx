import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'Terms & Conditions — Lyra Enterprises',
  description:
    'Terms governing use of Lyra Enterprises coffee vending machines and ' +
    'the brew.lyra-app.co.in ordering portal.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms &amp; Conditions" lastUpdated="6 May 2026">
      <p>
        These terms govern your use of the Lyra Enterprises coffee/tea
        vending machines (“Machines”) and the website
        <strong> brew.lyra-app.co.in </strong>
        (the “Service”). By scanning a Lyra QR code, paying for a drink or
        creating an account, you agree to these terms.
      </p>

      <h2>1. The service</h2>
      <p>
        Lyra Enterprises operates internet-connected vending machines that
        dispense filter coffee and tea on demand. Customers place orders
        through a web interface accessed by scanning a QR code on the
        Machine. Payment is collected through Razorpay using UPI, cards or
        net-banking.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be 18 years or older, or have the consent of a parent or
        legal guardian, to place a paid order. You must provide accurate
        contact information so we can issue refunds and resolve disputes.
      </p>

      <h2>3. Pricing</h2>
      <p>
        The price of each drink is displayed on the order screen before you
        confirm payment. Prices are inclusive of applicable taxes. Lyra
        Enterprises may change prices from time to time; the price shown at
        the moment of checkout is the price that applies to that order.
      </p>

      <h2>4. Order, payment and dispense</h2>
      <ul>
        <li>
          An order is treated as accepted only after Razorpay confirms the
          payment to our server.
        </li>
        <li>
          Once accepted, the Machine attempts to dispense the drink within
          approximately 30 seconds.
        </li>
        <li>
          If the Machine fails to dispense (e.g. out of milk, motor fault,
          power loss), you are entitled to a refund. See the{' '}
          <a href="/refund-policy">Refund &amp; Cancellation Policy</a>.
        </li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Tamper with, damage, vandalise or misuse any Machine.</li>
        <li>Use the Service for any illegal purpose or in violation of any law.</li>
        <li>
          Attempt to bypass payment, exploit bugs, scrape data or interfere
          with the security of the Service.
        </li>
        <li>
          Resell drinks dispensed by Lyra Machines without our written
          permission.
        </li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>
        All trademarks, logos, software, designs and content on the Service
        are owned by Lyra Enterprises and are protected by Indian and
        international intellectual-property laws. You may not copy, modify
        or reuse them without prior written consent.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Lyra Enterprises’ total
        liability for any claim related to a single order is limited to the
        amount paid for that order. We are not liable for indirect, special
        or consequential losses (including loss of business, data or
        goodwill).
      </p>

      <h2>8. Privacy</h2>
      <p>
        We process personal data as described in our{' '}
        <a href="/privacy">Privacy Policy</a>. By using the Service you
        consent to that processing.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms from time to time. Material changes will
        be announced on the Service. Continued use after a change constitutes
        acceptance of the new terms.
      </p>

      <h2>10. Governing law &amp; jurisdiction</h2>
      <p>
        These terms are governed by the laws of India. Any dispute will be
        subject to the exclusive jurisdiction of the courts at Chennai,
        Tamil Nadu.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a href="mailto:sales@lyraenterprise.co.in">
          sales@lyraenterprise.co.in
        </a>{' '}
        or call <a href="tel:+918122378860">+91-81223 78860</a>.
      </p>
    </LegalShell>
  );
}
