export const metadata = {
  title: "SMS Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <div style={container}>
        <h1 style={h1}>SMS Privacy Policy</h1>
        <p style={muted}>Last updated: {new Date().getFullYear()}</p>

        <p style={p}>
          This policy explains how Simplicity Pleasing (&ldquo;we,&rdquo; &ldquo;us&rdquo;) handles
          information in connection with our text-message (SMS) program. This program sends an
          automated text reply to people who call our business phone number and do not reach us.
        </p>

        <h2 style={h2}>How we collect your number</h2>
        <p style={p}>
          We receive your mobile number only when you call our business phone number. If your call is
          missed, we send you a one-time automated text to continue the conversation about the service
          you were calling about. We do not collect numbers from any other source.
        </p>

        <h2 style={h2}>We do not sell or share your number</h2>
        <p style={p}>
          <strong>We do not sell, rent, or share your mobile phone number or SMS consent with any third
          parties for marketing purposes.</strong> Numbers are used solely to respond to your inquiry.
          Information may be processed by our messaging provider (Twilio) only to deliver these messages.
        </p>

        <h2 style={h2}>Message frequency &amp; rates</h2>
        <p style={p}>
          Message frequency is low — typically 1&ndash;2 messages per inquiry. <strong>Message and data
          rates may apply.</strong>
        </p>

        <h2 style={h2}>Opt-out &amp; help</h2>
        <p style={p}>
          You can opt out at any time by replying <strong>STOP</strong>. For help, reply
          <strong> HELP</strong> or contact us at the email below.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Questions about this policy? Email <a style={link} href="mailto:kjkevo123@gmail.com">kjkevo123@gmail.com</a>.
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
