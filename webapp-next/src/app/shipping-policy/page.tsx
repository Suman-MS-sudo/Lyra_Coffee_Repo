import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'Shipping & Service Delivery Policy — Lyra Enterprises',
  description:
    'How and when drinks are delivered after payment on Lyra Enterprises ' +
    'vending machines.',
};

export default function ShippingPolicyPage() {
  return (
    <LegalShell
      title="Shipping &amp; Service Delivery Policy"
      lastUpdated="6 May 2026"
    >
      <p>
        Lyra Enterprises does not ship physical goods to customers through
        this Service. Beverages are dispensed locally by the specific
        vending Machine you scanned. This page exists to satisfy
        Razorpay&rsquo;s policy requirements and to set clear expectations for
        on-the-spot service delivery.
      </p>

      <h2>1. Where “delivery” happens</h2>
      <p>
        Your order is delivered at the physical location of the Machine you
        ordered from. The drink is dispensed into a cup directly under the
        nozzle of that Machine. The Machine&rsquo;s location is shown on the
        order screen before payment.
      </p>

      <h2>2. Delivery time</h2>
      <ul>
        <li>
          After Razorpay confirms your payment, the drink is brewed and
          dispensed within approximately <strong>30 seconds</strong>
          (depending on drink type and strength).
        </li>
        <li>
          The customer must remain at the Machine until the cup is fully
          dispensed.
        </li>
      </ul>

      <h2>3. Service availability</h2>
      <p>
        Machines are available 24×7 unless they are temporarily marked
        “maintenance” or “offline” on the order screen. If the Machine is
        offline, you will not be able to start checkout — no charge will be
        made.
      </p>

      <h2>4. Failed delivery</h2>
      <p>
        If a drink is not dispensed despite a successful payment, you are
        entitled to a full refund. Please follow the steps in our{' '}
        <a href="/refund-policy">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>5. Hardware sales / B2B orders</h2>
      <p>
        Sales of vending Machines, spare parts and consumables are handled
        separately by Lyra Enterprises through{' '}
        <a
          href="https://lyraenterprise.co.in"
          target="_blank"
          rel="noopener noreferrer"
        >
          lyraenterprise.co.in
        </a>{' '}
        and direct enquiry. Shipping terms for hardware orders are agreed in
        the corresponding sales order or invoice.
      </p>

      <h2>6. Contact</h2>
      <p>
        For any issue with delivery of a drink or hardware order, write to{' '}
        <a href="mailto:sales@lyraenterprise.co.in">
          sales@lyraenterprise.co.in
        </a>{' '}
        or call <a href="tel:+918122378860">+91-81223 78860</a>.
      </p>
    </LegalShell>
  );
}
