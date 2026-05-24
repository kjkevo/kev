import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — LeadIQ",
  description: "LeadIQ privacy policy and GDPR information",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            &larr; Back to LeadIQ
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="prose dark:prose-invert max-w-none space-y-10">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              LeadIQ is a B2B lead intelligence and management platform that helps revenue teams find, qualify, and convert high-value prospects. We are the data controller for the personal data we process. You can reach us at{" "}
              <a href="mailto:privacy@leadiq.com" className="text-brand-600 dark:text-brand-400 underline">privacy@leadiq.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What Data We Collect</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">Account information:</strong> Your name, email address, and hashed password when you register.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Lead data:</strong> Contact names, emails, phone numbers, company information, and sales notes that you enter into the platform.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Activity logs:</strong> Notes, calls, emails, and other activities you log against leads.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Usage data:</strong> Records of actions you take within the platform (for audit and security purposes).</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Authentication data:</strong> Session tokens and, if enabled, your 2FA secret (stored encrypted).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Why We Collect It</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">We process your data on the following lawful bases:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">Contract performance:</strong> To provide the LeadIQ service you have signed up for.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Legitimate interests:</strong> Security monitoring, fraud prevention, and service improvement.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Legal obligations:</strong> Compliance with applicable law and regulatory requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How Long We Keep It</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We retain your personal data for as long as your account is active. When you delete your account, all associated data — including leads, activities, notifications, and audit logs — is permanently deleted from our systems. Backup data may persist for up to 30 days before being purged. Anonymized, aggregated analytics data may be retained indefinitely as it cannot be used to identify you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
              Under the GDPR and applicable data protection laws, you have the following rights:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong className="text-gray-800 dark:text-gray-200">Right of access:</strong> Request a copy of all personal data we hold about you.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Right to rectification:</strong> Correct any inaccurate personal data.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Right to erasure:</strong> Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;).</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Right to data portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Right to object:</strong> Object to processing based on legitimate interests.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Right to restrict processing:</strong> Request that we limit how we use your data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. How to Exercise Your Rights</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              You can exercise most of your rights directly from your{" "}
              <Link href="/gdpr" className="text-brand-600 dark:text-brand-400 underline">Data Rights page</Link>.
              You can download all your data as a JSON export or permanently delete your account in one click.
              For other requests or inquiries, contact us at{" "}
              <a href="mailto:privacy@leadiq.com" className="text-brand-600 dark:text-brand-400 underline">privacy@leadiq.com</a>.
              We respond to all GDPR requests within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              LeadIQ uses only essential cookies required to keep you signed in. We do not use tracking, advertising, or analytics cookies. The cookies we set are:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mt-3">
              <li><strong className="text-gray-800 dark:text-gray-200">next-auth.session-token:</strong> Your authentication session token. HttpOnly, Secure, expires in 30 days.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">tf_done:</strong> Records that you have completed 2FA verification. HttpOnly, expires in 24 hours.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We may update this privacy policy from time to time. We will notify registered users of any material changes by email at least 14 days before they take effect. The &ldquo;last updated&rdquo; date at the top of this page always reflects the current version. Continued use of LeadIQ after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <p>Questions? Email us at <a href="mailto:privacy@leadiq.com" className="text-brand-600 dark:text-brand-400 underline">privacy@leadiq.com</a></p>
          <div className="mt-2 flex gap-4">
            <Link href="/gdpr" className="text-brand-600 dark:text-brand-400 hover:underline">Your Data Rights</Link>
            <Link href="/" className="hover:underline">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
