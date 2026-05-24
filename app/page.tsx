import Navbar from "./components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: "🎯",
    title: "Intent Signals",
    description:
      "Identify prospects actively researching your category with real-time buying intent data.",
  },
  {
    icon: "🏢",
    title: "Firmographic Enrichment",
    description:
      "Automatically enrich leads with company size, revenue, tech stack, and growth signals.",
  },
  {
    icon: "📬",
    title: "Contact Intelligence",
    description:
      "Verified emails and direct dials for decision-makers — no bounces, no gatekeepers.",
  },
  {
    icon: "⚡",
    title: "CRM Sync",
    description:
      "Push enriched leads directly to Salesforce, HubSpot, or any CRM in one click.",
  },
  {
    icon: "🤖",
    title: "AI Lead Scoring",
    description:
      "Prioritize your pipeline automatically with machine-learning scores tuned to your ICP.",
  },
  {
    icon: "📊",
    title: "Pipeline Analytics",
    description:
      "Track conversion from first touch to closed-won with attribution built in from day one.",
  },
];

const stats = [
  { value: "40M+", label: "Verified contacts" },
  { value: "5M+", label: "Companies tracked" },
  { value: "3×", label: "Average pipeline increase" },
  { value: "98%", label: "Email deliverability" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-brand-50 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block mb-4 text-xs font-semibold tracking-widest text-brand-600 uppercase bg-brand-100 px-3 py-1 rounded-full">
            B2B Lead Intelligence Platform
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Find leads that are{" "}
            <span className="text-brand-600">ready to buy</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            LeadIQ combines intent data, firmographic enrichment, and AI scoring
            to surface your highest-value prospects — before your competitors do.
          </p>
          <div className="flex justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-100"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold text-brand-700">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything you need to fill the pipeline
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              One platform to find, enrich, score, and engage your best-fit accounts.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-24 px-6 bg-brand-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to grow faster?
          </h2>
          <p className="text-brand-100 mb-10">
            Join 2,000+ revenue teams using LeadIQ to hit their pipeline goals.
            No credit card required.
          </p>
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-white text-brand-700 font-semibold rounded-xl hover:bg-brand-50 transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-bold text-white text-base">LeadIQ</p>
          <p>© {new Date().getFullYear()} LeadIQ. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/gdpr" className="hover:text-white transition-colors">Your Data Rights</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
