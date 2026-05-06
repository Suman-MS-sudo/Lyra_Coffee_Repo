import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title:       'Privacy Policy — Lyra Enterprises',
  description:
    'How Lyra Enterprises collects, uses and protects personal data of ' +
    'customers using brew.lyra-app.co.in and Lyra coffee vending machines.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="6 May 2026">
      <p>
        This policy explains what personal data Lyra Enterprises collects
        when you use our coffee/tea vending machines or the website
        <strong> brew.lyra-app.co.in</strong>, why we collect it, and how
        you can exercise your rights over it.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — phone number and an optional name
          when you sign in to the customer portal.
        </li>
        <li>
          <strong>Order data</strong> — drink type, customisation, machine
          ID, timestamp and order amount.
        </li>
        <li>
          <strong>Payment metadata</strong> — Razorpay order id, payment id
          and signature. We do <strong>not</strong> see or store card
          numbers, UPI PINs or net-banking credentials. Those are handled
          entirely by Razorpay (PCI-DSS Level 1 certified).
        </li>
        <li>
          <strong>Technical data</strong> — IP address, browser/user-agent,
          and basic device information used for security and abuse
          prevention.
        </li>
      </ul>

      <h2>2. Why we collect it</h2>
      <ul>
        <li>To accept and fulfil your order on a specific Machine.</li>
        <li>
          To process payments securely and to issue refunds where required.
        </li>
        <li>
          To detect fraud, abuse or technical issues, and to keep the
          Service available.
        </li>
        <li>
          To respond to customer support queries you raise with us.
        </li>
        <li>
          To comply with our legal and tax obligations under Indian law.
        </li>
      </ul>

      <h2>3. Where data is stored</h2>
      <p>
        Customer and order data is stored in our Supabase database hosted
        within the Asia/Pacific region. Payment processing is performed by
        Razorpay Software Private Limited (India). We do not sell or rent
        your personal data.
      </p>

      <h2>4. Sharing with third parties</h2>
      <p>We share limited personal data only with:</p>
      <ul>
        <li>
          <strong>Razorpay</strong> — to process payments and refunds.
        </li>
        <li>
          <strong>Supabase</strong> — as our managed database/hosting provider.
        </li>
        <li>
          <strong>Government / law-enforcement</strong> — only when required
          by valid legal process.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        We use a small number of strictly-necessary cookies to keep you
        signed in and to protect against CSRF attacks. We do not use
        advertising or third-party tracking cookies on this Service.
      </p>

      <h2>6. Retention</h2>
      <p>
        Order and payment records are retained for at least 8 years to
        comply with Indian accounting and tax law. Account information is
        retained as long as your account is active. You may request deletion
        of your account at any time, subject to the retention requirements
        above.
      </p>

      <h2>7. Your rights</h2>
      <p>You may request, free of charge:</p>
      <ul>
        <li>A copy of the personal data we hold about you.</li>
        <li>Correction of inaccurate data.</li>
        <li>Deletion of data not legally required to be retained.</li>
        <li>To withdraw consent and stop further processing.</li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href="mailto:sales@lyraenterprise.co.in">
          sales@lyraenterprise.co.in
        </a>{' '}
        from the address linked to your account.
      </p>

      <h2>8. Security</h2>
      <p>
        Traffic to brew.lyra-app.co.in is protected by HTTPS/TLS. Passwords
        and API keys are stored only as salted hashes; payment secrets are
        never written to our servers. We follow industry-standard practices
        for access control and audit logging.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy from time to time. The “Last updated” date
        at the top of the page reflects the most recent revision.
      </p>

      <h2>10. Grievance officer</h2>
      <p>
        In line with the Information Technology (Reasonable Security
        Practices and Procedures and Sensitive Personal Data or Information)
        Rules, 2011, our grievance officer is:
      </p>
      <p>
        <strong>Lyra Enterprises — Grievance Officer</strong><br />
        10/21, Vasuki Street, Cholapuram, Ambattur, Chennai – 600053.<br />
        Email:{' '}
        <a href="mailto:sales@lyraenterprise.co.in">
          sales@lyraenterprise.co.in
        </a>
      </p>
    </LegalShell>
  );
}
