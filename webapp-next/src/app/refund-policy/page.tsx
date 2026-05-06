import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'Refund & Cancellation Policy — Lyra Enterprises',
  description:
    'When and how Lyra Enterprises issues refunds for failed coffee/tea ' +
    'dispenses on our vending machines.',
};

export default function RefundPolicyPage() {
  return (
    <LegalShell title="Refund &amp; Cancellation Policy" lastUpdated="6 May 2026">
      <p>
        Lyra Enterprises sells single-serve hot beverages dispensed by
        connected vending machines. Because each drink is brewed
        immediately on payment, our refund rules are simple and tailored to
        what can actually go wrong.
      </p>

      <h2>1. Cancellation</h2>
      <p>
        Once payment has been confirmed by Razorpay, the Machine starts
        brewing within a few seconds. Orders <strong>cannot be cancelled</strong>
        after payment confirmation. You can stop an order at any moment
        before tapping <em>Pay</em> in the checkout dialog.
      </p>

      <h2>2. When you are entitled to a full refund</h2>
      <p>You are entitled to a 100% refund if any of the following happens:</p>
      <ul>
        <li>
          Payment is debited from your account but the order does not appear
          on our system within 10 minutes (e.g. network failure between
          Razorpay and our server).
        </li>
        <li>
          The Machine accepts the order but fails to dispense the drink
          (out of milk, water, motor fault, power loss, etc.).
        </li>
        <li>
          The Machine dispenses the wrong drink (e.g. coffee instead of
          tea) due to a software fault.
        </li>
      </ul>

      <h2>3. When refunds are not given</h2>
      <ul>
        <li>
          A drink that has been dispensed correctly cannot be returned for a
          refund — it is a perishable, single-serve food item.
        </li>
        <li>
          Subjective preferences (taste, sweetness, strength) are not
          eligible for a refund. You can choose <em>light</em>,{' '}
          <em>medium</em> or <em>strong</em> at the order screen before
          paying.
        </li>
        <li>
          Damage caused by the customer (e.g. spilling the cup, removing it
          early) is not eligible for a refund.
        </li>
      </ul>

      <h2>4. How to claim a refund</h2>
      <ol>
        <li>
          Email{' '}
          <a href="mailto:sales@lyraenterprise.co.in">
            sales@lyraenterprise.co.in
          </a>{' '}
          within <strong>7 days</strong> of the failed order.
        </li>
        <li>
          Include the <strong>Razorpay payment reference</strong> (visible
          in your bank or UPI app), the <strong>machine location</strong>{' '}
          and the approximate <strong>time</strong> of the order.
        </li>
        <li>
          We will verify the transaction against our server logs and the
          machine’s dispense record.
        </li>
      </ol>

      <h2>5. Refund processing time</h2>
      <p>
        Once approved, refunds are initiated through Razorpay to the
        original payment method:
      </p>
      <ul>
        <li>UPI / wallet — typically within 1–3 working days.</li>
        <li>Credit / debit card — typically within 5–7 working days.</li>
        <li>Net-banking — typically within 3–5 working days.</li>
      </ul>
      <p>
        Actual posting time depends on your issuing bank. Lyra Enterprises
        does not retain any cancellation or processing fee — the full
        amount is refunded.
      </p>

      <h2>6. Disputes</h2>
      <p>
        If you do not agree with the resolution proposed, you may escalate
        the matter to our grievance officer (see{' '}
        <a href="/privacy">Privacy Policy &mdash; Section 10</a>) or contact
        Razorpay’s customer support directly.
      </p>
    </LegalShell>
  );
}
