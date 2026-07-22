export const metadata = {
  title: "SMS Terms & Conditions",
};

export default function TermsPage() {
  return (
    <main style={wrap}>
      <div style={container}>
        <h1 style={h1}>SMS Terms &amp; Conditions</h1>
        <p style={muted}>Last updated: {new Date().getFullYear()}</p>

        <p style={p}>
          By calling Simplicity Pleasing and receiving our automated text reply, you agree to these
          terms for our SMS program.
        </p>

        <h2 style={h2}>Program description</h2>
        <p style={p}>
          When you call our business phone number (+1&nbsp;847&nbsp;613&nbsp;1968) and we miss your call,
          we send a one-time automated text message to that number so we can continue the conversation
          about the service you requested (such as DJing, photo booth, or party decoration) and follow up
          to help book your event. This is a customer-care / conversational program, not marketing.
        </p>

        <h2 style={h2}>Consent (how you opt in)</h2>
        <p style={p}>
          You provide express consent to receive these messages <strong>by calling our business phone
          number</strong>, or by submitting our web form at <a style={link} href="/opt-in">/opt-in</a> and
          checking the consent box. When your call is not answered, you agree to receive a reply text about
          your inquiry. We do not obtain numbers from purchased lists or third parties. Consent to receive
          text messages is not a condition of any purchase, and we never sell or share your mobile number
          with third parties for marketing.
        </p>

        <h2 style={h2}>Message frequency &amp; cost</h2>
        <p style={p}>
          Message frequency is low — typically 1&ndash;2 messages per inquiry. Message and data rates may
          apply, depending on your mobile carrier and plan.
        </p>

        <h2 style={h2}>Opt-out &amp; help</h2>
        <p style={p}>
          Reply <strong>STOP</strong> at any time to stop receiving messages. Reply <strong>HELP</strong> for
          assistance, or email us at the address below. We do not sell or share your mobile number with
          third parties for marketing.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Email <a style={link} href="mailto:kjkevo123@gmail.com">kjkevo123@gmail.com</a> with any questions.
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
