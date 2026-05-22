import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Lead enrichment — fetches real company data from the website's metadata
// ---------------------------------------------------------------------------

const INDUSTRY_KEYWORDS: [RegExp, string][] = [
  [/saas|software|platform|cloud|api|devops|data|ai|ml|analytics/, "Software / SaaS"],
  [/finance|fintech|banking|payment|invest|crypto|insurance/, "Fintech / Finance"],
  [/health|medic|clinic|pharma|biotech|wellness|hospital/, "Healthcare / Biotech"],
  [/market|advertis|agency|media|content|seo|social|pr /, "Marketing / Media"],
  [/retail|ecommerce|e-commerce|shop|store|commerce/, "Retail / eCommerce"],
  [/consult|advisory|strategy|professional service/, "Consulting"],
  [/manufacture|hardware|industrial|logistic|supply|warehouse/, "Manufacturing / Logistics"],
  [/education|edtech|learning|school|university|training/, "Education / EdTech"],
  [/real estate|property|construction|architecture/, "Real Estate"],
  [/legal|law firm|compliance|attorney/, "Legal"],
  [/recruit|staffing|hr|talent|hiring|people ops/, "HR / Recruiting"],
  [/food|restaurant|hospitality|travel|hotel|tourism/, "Food / Hospitality"],
  [/energy|clean|solar|climate|sustainability/, "Energy / CleanTech"],
  [/nonprofit|ngo|foundation|charity/, "Nonprofit"],
];

const SIZE_KEYWORDS: [RegExp, string][] = [
  [/enterprise|fortune|global|worldwide|international|thousands of/, "1000+ employees"],
  [/mid-market|growing company|hundreds of|series [cd]/, "200–1000 employees"],
  [/startup|early-stage|seed|series [ab]|small team|lean team/, "1–50 employees"],
  [/scale|scaling|series [bc]|mid-size|mid-stage/, "50–200 employees"],
];

async function fetchOgData(domain: string): Promise<{ title: string; description: string }> {
  try {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadIQ-Enricher/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    // Extract og:site_name, og:title, <title>
    const ogSite = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";

    // Clean up company name: prefer og:site_name, then og:title, then <title>
    let rawName = ogSite || ogTitle || pageTitle;
    // Remove common suffixes like "| Home", "- Official Site", etc.
    rawName = rawName.replace(/\s*[\|\-–—]\s*.{0,40}$/, "").trim();

    return { title: rawName, description: ogDesc || metaDesc };
  } catch {
    return { title: "", description: "" };
  }
}

function inferIndustry(text: string): string {
  const lower = text.toLowerCase();
  for (const [pattern, label] of INDUSTRY_KEYWORDS) {
    if (pattern.test(lower)) return label;
  }
  return "Technology";
}

function inferSize(text: string): string {
  const lower = text.toLowerCase();
  for (const [pattern, label] of SIZE_KEYWORDS) {
    if (pattern.test(lower)) return label;
  }
  return "Unknown";
}

function domainToCompanyName(domain: string): string {
  // Strip TLD and capitalise: "acmecorp.com" → "Acmecorp"
  const base = domain.replace(/^www\./, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { domain?: string };
  const domain = (body.domain ?? "").trim().toLowerCase().replace(/^@/, "");

  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  const website = `https://${domain.replace(/^https?:\/\//, "")}`;

  // Fetch real OG data from the company website
  const { title, description } = await fetchOgData(domain);

  const companyName = title || domainToCompanyName(domain);
  const industry = inferIndustry(description + " " + title);
  const size = inferSize(description);

  return NextResponse.json({ companyName, industry, size, website });
}
