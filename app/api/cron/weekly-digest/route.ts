import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Fetch the digest data from our own endpoint
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;
  const digestRes = await fetch(`${baseUrl}/api/analytics/digest`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!digestRes.ok) {
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }

  const data = await digestRes.json();

  const resendApiKey = process.env.RESEND_API_KEY;
  const digestEmail = process.env.DIGEST_EMAIL;

  if (resendApiKey && digestEmail) {
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "LeadIQ Digest <digest@yourdomain.com>",
          to: [digestEmail],
          subject: `LeadIQ Weekly Digest — ${new Date().toLocaleDateString()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h1 style="color: #1d4ed8; margin-bottom: 4px;">LeadIQ Weekly Digest</h1>
              <p style="color: #6b7280; margin-top: 0;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>

              <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">New Leads This Week</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1d4ed8;">${data.newLeadsThisWeek}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Deals Closed</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669;">${data.dealsClosedThisWeek}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Deals Lost</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc2626;">${data.dealsLostThisWeek}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Pipeline Value</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #374151;">$${data.pipelineValue.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Weighted Pipeline</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #374151;">$${data.weightedPipeline.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              ${data.topLead ? `
              <div style="background: #fefce8; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: 600; letter-spacing: 0.05em;">Top Lead</p>
                <p style="margin: 0; font-weight: bold; color: #1f2937;">${data.topLead.companyName}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #6b7280;">${data.topLead.contactName} · AI Score: ${data.topLead.aiScore}</p>
              </div>` : ""}

              ${Object.keys(data.lossReasonSummary).length > 0 ? `
              <div style="margin: 20px 0;">
                <p style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 8px;">Loss Reasons</p>
                ${Object.entries(data.lossReasonSummary).map(([r, c]) => `<p style="margin: 4px 0; font-size: 14px; color: #374151;">${r}: <strong>${c}</strong></p>`).join("")}
              </div>` : ""}

              <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">Sent automatically by LeadIQ every Monday at 9am.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("[weekly-digest] Resend error:", errText);
        return NextResponse.json({ success: false, error: "Email send failed", digest: data }, { status: 500 });
      }

      console.log("[weekly-digest] Email sent to", digestEmail);
      return NextResponse.json({ success: true, emailSent: true, digest: data });
    } catch (err) {
      console.error("[weekly-digest] Unexpected error:", err);
      return NextResponse.json({ success: false, error: String(err), digest: data }, { status: 500 });
    }
  } else {
    // No Resend configured — log to console and return JSON
    console.log("[weekly-digest] No RESEND_API_KEY set. Digest data:", JSON.stringify(data, null, 2));
    return NextResponse.json({ success: true, emailSent: false, digest: data });
  }
}
