export const metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  return (
    <main style={wrap}>
      <div style={container}>
        <h1 style={h1}>Terms &amp; Conditions</h1>
        <p style={muted}>Last updated: {new Date().getFullYear()}</p>

        <p style={p}>
          These Terms govern your use of the Slimpse website and the automated missed-call text-back service
          (the &ldquo;Service&rdquo;) provided by Simplicity Pleasing, operating under the brand{" "}
          <strong>Slimpse</strong> (&ldquo;Slimpse,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By signing up
          or using the Service, you agree to these Terms.
        </p>

        <h2 style={h2}>Who can use the Service</h2>
        <p style={p}>
          The Service is for businesses. You must be at least 18 and able to enter a contract, and you are
          responsible for the accuracy of the information you provide.
        </p>

        <h2 style={h2}>Free trial &amp; billing</h2>
        <p style={p}>
          New clients start with a <strong>14-day free trial</strong> &mdash; no card required to begin.
          After the trial, the Service is <strong>$59.99/month</strong> for Voice or Text alone, or{" "}
          <strong>$100/month</strong> for both Voice and Text, unless otherwise agreed, processed by Stripe.
          You can cancel anytime; if you do not add payment, the Service simply pauses when the trial ends.
          Fees are non-refundable except where required by law.
        </p>

        <h2 style={h2}>Your responsibilities (messaging &amp; consent)</h2>
        <p style={p}>
          You are responsible for using the Service lawfully with respect to your own customers, including
          obtaining any consent required to send text messages under the Telephone Consumer Protection Act
          (TCPA) and applicable state law, honoring opt-out requests, and providing accurate information for
          carrier registration. Additional terms for paying clients are set out in our Client Service
          Agreement.
        </p>

        <h2 style={h2}>SMS program</h2>
        <p style={p}>
          Recipients consent to receive automated texts by calling a business phone number served by Slimpse
          that is not answered, or by submitting a web opt-in form. Message frequency is low (typically
          1&ndash;2 messages per inquiry), and message and data rates may apply. Reply <strong>STOP</strong>{" "}
          to opt out or <strong>HELP</strong> for help. We do not sell or share mobile information with third
          parties for marketing.
        </p>

        <h2 style={h2}>Acceptable use</h2>
        <p style={p}>
          You agree not to use the Service for unlawful, deceptive, harassing, or prohibited content, or in a
          way that violates carrier rules or the rights of others.
        </p>

        <h2 style={h2}>Disclaimers</h2>
        <p style={p}>
          The Service is provided &ldquo;as is.&rdquo; We do not guarantee message delivery, which depends on
          third parties (carriers, Twilio, recipient devices) and carrier filtering outside our control.
          Availability is addressed in our Service Level Agreement.
        </p>

        <h2 style={h2}>Limitation of liability</h2>
        <p style={p}>
          To the maximum extent permitted by law, our total liability arising out of or relating to the
          Service is limited to the fees you paid us in the three months before the claim. We are not liable
          for indirect, incidental, or consequential damages.
        </p>

        <h2 style={h2}>Termination</h2>
        <p style={p}>
          You may stop using the Service at any time. We may suspend or terminate access for non-payment or
          violation of these Terms.
        </p>

        <h2 style={h2}>Governing law</h2>
        <p style={p}>
          These Terms are governed by the laws of the State of Illinois, without regard to conflict-of-laws
          rules.
        </p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>
          We may update these Terms on reasonable notice. Continued use after an update means you accept the
          revised Terms.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Slimpse &mdash; <a style={link} href="mailto:Slimpsehelp@gmail.com">Slimpsehelp@gmail.com</a>. See
          also our <a style={link} href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#070B15", color: "#E5E9F0", padding: "48px 20px", fontFamily: "system-ui, -apple-system, sans-serif" };
const container: React.CSSProperties = { maxWidth: 720, margin: "0 auto" };
const h1: React.CSSProperties = { fontSize: 30, fontWeight: 800, margin: 0 };
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 700, margin: "28px 0 8px" };
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "#C7CEDB", margin: "0 0 8px" };
const muted: React.CSSProperties = { fontSize: 13, color: "#7A828F", margin: "6px 0 24px" };
const link: React.CSSProperties = { color: "#8FB8FF" };
