export const dynamic = "force-dynamic";

import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default async function LeadsDashboard() {
  const { data: leads } = await supabase
    .from("Lead")
    .select("*")
    .order("createdAt", { ascending: false });

  const allLeads = leads ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-brand-700">
          LeadIQ
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Dashboard</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">{allLeads.length} total leads</span>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">All Leads</h2>
          </div>

          <div className="divide-y divide-gray-50">
            {allLeads.length === 0 && (
              <p className="px-6 py-12 text-center text-gray-400">
                No leads yet. Use the dashboard to import leads via CSV.
              </p>
            )}

            {allLeads.map((lead) => (
              <div key={lead.id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900">{lead.contactName}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600 text-sm">{lead.title}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-medium text-brand-600 text-sm">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {lead.companyName}
                          </a>
                        ) : (
                          lead.companyName
                        )}
                      </span>
                    </div>

                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>{lead.email}</span>
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          Trigger
                        </span>
                        <p className="text-sm text-gray-700">{lead.triggerEvent}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          Intel
                        </span>
                        <p className="text-sm text-gray-500">{lead.intelligenceSummary}</p>
                      </div>
                    </div>
                  </div>

                  <time className="shrink-0 text-xs text-gray-400">
                    {new Date(lead.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
