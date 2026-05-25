import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080D1A] text-white">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080D1A]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#00E5C4] text-lg font-bold leading-none">■</span>
            <span className="font-semibold text-white tracking-tight text-base">Pulse</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-[#94A3B8] hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium bg-[#00E5C4] text-[#080D1A] px-4 py-1.5 rounded-full hover:bg-[#33EBD0] transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center justify-center dot-grid overflow-hidden pt-16">
        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 60%, rgba(0,229,196,0.07) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-[#00E5C4]/30 bg-[#00E5C4]/5 text-[#00E5C4] text-sm font-medium animate-fade-in"
          >
            <span className="text-[10px]">✦</span>
            AI-Powered ICP Matching
          </div>

          {/* H1 */}
          <h1
            className="text-[64px] md:text-[80px] font-bold leading-[1.05] tracking-tight mb-6 animate-fade-up"
            style={{ animationDelay: "0.1s", opacity: 0 }}
          >
            Find the leads that are{" "}
            <span className="text-[#00E5C4] teal-text-glow">already looking</span>
          </h1>

          {/* Subtext */}
          <p
            className="text-lg md:text-xl text-[#94A3B8] max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up"
            style={{ animationDelay: "0.2s", opacity: 0 }}
          >
            Pulse identifies your ideal customers in real time, scores them by intent,
            and crafts hyper-personalized outreach — so your team closes, not cold calls.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up"
            style={{ animationDelay: "0.3s", opacity: 0 }}
          >
            <Link
              href="/dashboard"
              className="px-7 py-3.5 bg-[#00E5C4] text-[#080D1A] font-semibold rounded-full text-sm hover:bg-[#33EBD0] transition-all teal-glow"
            >
              Start free trial →
            </Link>
            <button className="px-7 py-3.5 border border-white/10 rounded-full text-sm text-[#94A3B8] hover:text-white hover:border-white/20 transition-all">
              Watch 2-min demo
            </button>
          </div>

          {/* Social proof */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up"
            style={{ animationDelay: "0.4s", opacity: 0 }}
          >
            <div className="flex -space-x-2">
              {[
                { initials: "SC", bg: "#0D4A3E" },
                { initials: "MW", bg: "#1A3A5C" },
                { initials: "PN", bg: "#2D1A5C" },
                { initials: "JK", bg: "#3A2A0A" },
                { initials: "AT", bg: "#1A4A2A" },
              ].map((a) => (
                <div
                  key={a.initials}
                  className="w-8 h-8 rounded-full border-2 border-[#080D1A] flex items-center justify-center text-[10px] font-semibold text-white"
                  style={{ backgroundColor: a.bg }}
                >
                  {a.initials}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#00E5C4] text-xs tracking-widest">★★★★★</span>
              <span className="font-mono text-[#94A3B8] text-xs">4.9/5.0</span>
              <span className="text-[#475569] text-xs">· Trusted by 800+ revenue teams</span>
            </div>
          </div>

          {/* Terminal card */}
          <div
            className="max-w-xl mx-auto animate-fade-up"
            style={{ animationDelay: "0.5s", opacity: 0 }}
          >
            <div className="glass-card gradient-border rounded-2xl p-6 text-left teal-glow">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-2 text-[#475569] text-xs font-mono">pulse — live matching</span>
              </div>
              <div className="font-mono text-sm space-y-3">
                <div className="text-[#00E5C4]">◆ Pulse is analyzing your ICP...</div>
                <div className="text-[#475569]">
                  ▸ Scanning 12M+ contacts · Filtering by intent score
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div>
                  <span className="text-[#00E5C4]">✓ Matched:</span>{" "}
                  <span className="text-white font-medium">Sarah Chen, VP Sales @ Vercel</span>
                </div>
                <div className="pl-4 space-y-1 text-[#94A3B8]">
                  <div>
                    Intent score:{" "}
                    <span className="text-[#00E5C4] font-semibold">94/100</span>
                  </div>
                  <div>Signal: Hiring 12 SDRs · Series B closed</div>
                  <div>
                    Email drafted{" "}
                    <span className="text-[#00E5C4]">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ─── */}
      <section className="py-16 border-y border-white/5 bg-[#0D1526]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "12M+", label: "Verified contacts" },
              { value: "94%", label: "Email deliverability" },
              { value: "3.2×", label: "Average reply rate lift" },
              { value: "< 2 min", label: "Time to first lead" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="text-center animate-fade-up"
                style={{ animationDelay: `${0.1 * i}s`, opacity: 0 }}
              >
                <div className="font-mono text-3xl md:text-4xl font-semibold text-[#00E5C4] teal-text-glow">
                  {stat.value}
                </div>
                <div className="mt-1.5 text-sm text-[#64748B]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#00E5C4] text-sm font-medium uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              How Pulse works
            </h2>
            <p className="mt-4 text-[#94A3B8] max-w-xl mx-auto text-lg">
              Three steps from ICP definition to booked meeting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "ICP Builder",
                desc: "Define your ideal customer once. Pulse learns from every closed deal and continuously refines your profile — so you always target the accounts most likely to convert.",
                delay: "0.1s",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: "Intent Signals",
                desc: "Real-time buying signals from 50+ data sources — hiring sprees, funding rounds, tech stack changes, job postings, and more. Know who's in-market before they raise their hand.",
                delay: "0.2s",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                ),
                title: "AI Outreach",
                desc: "Personalized emails crafted from signal context, auto-sequenced with smart send-time optimization, and A/B tested automatically — all without lifting a finger.",
                delay: "0.3s",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="glass-card gradient-border rounded-2xl p-8 animate-fade-up"
                style={{ animationDelay: f.delay, opacity: 0 }}
              >
                <div className="w-11 h-11 rounded-xl bg-[#00E5C4]/10 border border-[#00E5C4]/20 flex items-center justify-center text-[#00E5C4] mb-5">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Live feed preview ─── */}
      <section className="py-32 px-6 bg-[#0D1526]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#00E5C4] text-sm font-medium uppercase tracking-widest mb-3">
              Live feed
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Your pipeline, in real time
            </h2>
            <p className="mt-4 text-[#94A3B8] max-w-xl mx-auto text-lg">
              High-intent leads surface as signals fire — scored, enriched, and ready to contact.
            </p>
          </div>

          <div className="glass-card gradient-border rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_2fr_2fr_1fr_2fr_1fr] gap-4 px-6 py-3 border-b border-white/5 text-xs text-[#475569] uppercase tracking-widest font-medium">
              <div>Company</div>
              <div>Contact</div>
              <div>Title</div>
              <div>Score</div>
              <div>Signal</div>
              <div>Action</div>
            </div>

            {[
              { company: "Vercel", contact: "Sarah Chen", title: "VP Sales", score: 94, signal: "Hiring SDRs", action: "Draft email" },
              { company: "Linear", contact: "Marcus Webb", title: "CTO", score: 88, signal: "New funding", action: "View profile" },
              { company: "Stripe", contact: "Priya Nair", title: "Head of Growth", score: 91, signal: "Expanded team", action: "Draft email" },
              { company: "Figma", contact: "Jordan Kim", title: "Dir. BD", score: 79, signal: "Job postings spike", action: "View profile" },
              { company: "Notion", contact: "Alex Torres", title: "CMO", score: 85, signal: "Series C closed", action: "Draft email" },
            ].map((row, i) => (
              <div
                key={row.company}
                className={`group grid grid-cols-[2fr_2fr_2fr_1fr_2fr_1fr] gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors ${
                  i % 2 === 0 ? "bg-white/[0.01]" : ""
                }`}
              >
                <div className="text-sm font-medium text-white">{row.company}</div>
                <div className="text-sm text-[#94A3B8]">{row.contact}</div>
                <div className="text-sm text-[#64748B]">{row.title}</div>
                <div>
                  <span className="font-mono text-xs font-semibold text-[#00E5C4] bg-[#00E5C4]/10 px-2 py-0.5 rounded">
                    {row.score}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#64748B] bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                    {row.signal}
                  </span>
                </div>
                <div>
                  <button className="text-xs text-[#00E5C4] border border-[#00E5C4]/30 px-3 py-1 rounded-full hover:bg-[#00E5C4]/10 transition-colors opacity-0 group-hover:opacity-100">
                    {row.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,229,196,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Ready to close more deals?
          </h2>
          <p className="text-[#64748B] text-lg mb-10">
            Join 800+ teams already using Pulse to hit their pipeline goals.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-8 py-4 bg-[#00E5C4] text-[#080D1A] font-semibold rounded-full text-sm hover:bg-[#33EBD0] transition-all teal-glow"
          >
            Start free trial →
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#475569]">
          <div className="flex items-center gap-2">
            <span className="text-[#00E5C4] font-bold">■</span>
            <span className="font-semibold text-white">Pulse</span>
          </div>
          <p>© 2025 Pulse. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
