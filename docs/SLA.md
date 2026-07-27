# Service Level Agreement (SLA) — DRAFT

> **⚠️ DRAFT for attorney review.** This is a plain-English first draft, not legal
> advice. Have a qualified attorney review it before using it with clients.
> Replace every `[BRACKETED]` placeholder.

**Provider:** [COMPANY LEGAL NAME] ("we," "us")
**Effective date:** [DATE]

This SLA describes the uptime and support commitments for the missed-call
text-back service (the "Service") provided to [CLIENT] ("you").

## 1. Uptime commitment
We target **99.5% availability** of the Service each calendar month, measured as
the percentage of minutes the Service is able to receive call/webhook events and
send text messages, excluding the Exclusions below.

99.5% allows for roughly **3.5 hours** of unavailability per month.

## 2. What counts as "downtime"
Downtime is a period in which the Service cannot receive missed-call events or
send automated text-backs due to a failure within our platform.

## 3. Exclusions (not counted as downtime)
The uptime commitment does **not** apply to unavailability caused by:
- **Scheduled maintenance**, for which we give at least 24 hours' notice and which
  we schedule outside typical business hours where practical.
- **Third-party providers** outside our control — including but not limited to
  telecom carriers (Verizon, AT&T, T-Mobile, etc.), Twilio, hosting/CDN
  providers, or message filtering/blocking by carriers or the recipient.
- **A2P/10DLC registration** delays, carrier throttling, or message filtering.
- **Your** acts or omissions, misconfiguration, or failure to maintain call
  forwarding.
- **Force majeure** — events beyond our reasonable control (natural disasters,
  outages of the public internet, government action, etc.).

## 4. Service credits
This plan does **not** include automatic service credits. If the Service is
materially unavailable for an extended period due to our fault, contact us and we
will work with you in good faith on a reasonable resolution.

## 5. Support
- **Channel:** email to [SUPPORT EMAIL].
- **Target response time:** within **one business day**.
- **Business hours:** [e.g., Mon–Fri, 9am–5pm CT], excluding U.S. holidays.

## 6. Status & incident communication
We monitor the Service continuously (health checks and failure alerts). If we
become aware of a significant incident affecting your Service, we will make
reasonable efforts to notify you and to restore Service promptly.

## 7. Changes
We may update this SLA on reasonable notice. Continued use of the Service after
an update constitutes acceptance of the revised SLA.
