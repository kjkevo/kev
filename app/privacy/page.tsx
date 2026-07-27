export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <div style={container}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={muted}>Last updated: {new Date().getFullYear()}</p>

        <p style={p}>
          Simplicity Pleasing, operating under the brand <strong>Slimpse</strong> (&ldquo;Slimpse,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;), provides an automated missed-call text-back and messaging
          service for businesses (the &ldquo;Service&rdquo;). This Privacy Policy explains what we collect,
          how we use it, and your choices. Questions? Email{" "}
          <a style={link} href="mailto:Slimpsehelp@gmail.com">Slimpsehelp@gmail.com</a>.
        </p>

        <h2 style={h2}>Information we collect</h2>
        <p style={p}>
          <strong>From businesses who sign up:</strong> your name, business name, email address, mobile
          number, and the setup details you provide (such as your hours, services, tone, and example
          messages).
        </p>
        <p style={p}>
          <strong>From your callers (processed on your behalf):</strong> caller phone numbers and the
          details of missed calls and text messages handled by the Service for your business.
        </p>
        <p style={p}>
          <strong>Billing information:</strong> handled by our payment processor, Stripe. We do not store
          full card numbers.
        </p>
        <p style={p}>
          <strong>Usage and technical data:</strong> log data and basic analytics used to operate and
          secure the Service.
        </p>

        <h2 style={h2}>How we use information</h2>
        <p style={p}>
          To provide, configure, and operate the Service; to send account, setup, billing, and service
          notifications; to provide support; and to maintain security, prevent abuse, and comply with law.
        </p>

        <h2 style={h2}>SMS / messaging program</h2>
        <p style={p}>
          Recipients provide express consent to receive an automated text message when they{" "}
          <strong>call a business phone number served by Slimpse and the call is not answered</strong>, or
          by submitting a web opt-in form and checking the consent box. We never add numbers from purchased
          lists or third parties, and consent to receive texts is not a condition of any purchase. Message
          frequency is low (typically 1&ndash;2 messages per inquiry), and <strong>message and data rates
          may apply.</strong> Recipients can reply <strong>STOP</strong> to opt out or <strong>HELP</strong>{" "}
          for help at any time.
        </p>
        <p style={p}>
          <strong>No mobile information, opt-in data, or messaging consent will be sold, and it will not be
          shared with third parties or affiliates for their own marketing or promotional purposes.</strong>{" "}
          Phone numbers and messaging data are used solely to provide the Service.
        </p>

        <h2 style={h2}>Call recording</h2>
        <p style={p}>
          If a caller chooses to leave a voicemail after a missed call, the message may be recorded so the
          business can follow up. A spoken notice is played before any recording begins; a caller who does
          not wish to be recorded may hang up and text instead. Recordings are used only to respond to the
          inquiry and are never sold or shared for marketing purposes.
        </p>

        <h2 style={h2}>How we share information</h2>
        <p style={p}>
          We do <strong>not</strong> sell your personal information. We share information only with service
          providers who help us operate (such as Twilio for messaging/telephony, Stripe for payments, and
          our email provider), under agreements that limit their use of the data; for legal and safety
          reasons when required; and in connection with a business transfer such as a merger or sale.
        </p>

        <h2 style={h2}>Data retention &amp; security</h2>
        <p style={p}>
          We keep information for as long as needed to provide the Service and for legitimate business or
          legal purposes, then delete or de-identify it. We use reasonable measures to protect it, though no
          method of transmission or storage is completely secure.
        </p>

        <h2 style={h2}>Your choices &amp; rights</h2>
        <p style={p}>
          You may request access to, correction of, or deletion of your personal information by emailing{" "}
          <a style={link} href="mailto:Slimpsehelp@gmail.com">Slimpsehelp@gmail.com</a>. You can opt out of
          texts by replying STOP.
        </p>

        <h2 style={h2}>Children</h2>
        <p style={p}>The Service is for businesses and is not directed to individuals under 18.</p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>
          We may update this Policy from time to time and will post the updated version with a new
          &ldquo;Last updated&rdquo; date.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Slimpse &mdash; <a style={link} href="mailto:Slimpsehelp@gmail.com">Slimpsehelp@gmail.com</a>.
          See also our <a style={link} href="/terms">Terms &amp; Conditions</a>.
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
