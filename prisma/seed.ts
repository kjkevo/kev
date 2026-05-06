import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seeds = [
  {
    companyName: "TechCorp",
    website: "https://techcorp.io",
    contactName: "Sarah Chen",
    title: "VP of Engineering",
    email: "sarah.chen@techcorp.io",
    phone: "+1-415-555-0101",
    triggerEvent: "Posted a job listing for 5 senior DevOps engineers this week, signaling infrastructure scaling.",
    intelligenceSummary:
      "TechCorp is in a rapid hiring phase for infrastructure roles, which strongly correlates with increased tooling spend. Sarah Chen directly controls the engineering budget. High likelihood of evaluating CI/CD and observability vendors in the next 90 days.",
  },
  {
    companyName: "GrowthCo",
    website: "https://growthco.com",
    contactName: "Marcus Rivera",
    title: "Head of Revenue",
    email: "m.rivera@growthco.com",
    phone: "+1-646-555-0188",
    triggerEvent: "Announced a $12M Series A round on LinkedIn three days ago.",
    intelligenceSummary:
      "Fresh funding typically triggers a 60-day sales stack evaluation window. Marcus owns revenue tooling decisions. GrowthCo is expanding into enterprise accounts, which will strain their current outbound process.",
  },
  {
    companyName: "ScaleHQ",
    website: "https://scalehq.com",
    contactName: "Priya Nair",
    title: "CTO",
    email: "priya@scalehq.com",
    triggerEvent: "Published a blog post titled 'Why We Moved Away From Our Legacy CRM'.",
    intelligenceSummary:
      "Publishing a public post-mortem on a CRM migration is a strong buying signal — they are actively researching alternatives. Priya is a technical decision-maker who will evaluate APIs and integrations before any commercial conversation.",
  },
  {
    companyName: "InfraStack",
    website: "https://infrastack.dev",
    contactName: "James Whitfield",
    title: "CEO",
    email: "james.w@infrastack.dev",
    phone: "+1-512-555-0234",
    triggerEvent: "Attended our 'B2B Pipeline Automation' webinar and stayed for the full Q&A.",
    intelligenceSummary:
      "Webinar attendance by a CEO (not an IC) indicates strategic interest, not just curiosity. InfraStack has 8 employees and no dedicated sales ops — they are a strong candidate for an all-in-one solution. Follow up within 24 hours while intent is peak.",
  },
  {
    companyName: "DataPulse AI",
    website: "https://datapulse.ai",
    contactName: "Amara Osei",
    title: "Director of Sales",
    email: "aosei@datapulse.ai",
    phone: "+1-206-555-0177",
    triggerEvent: "Competitor Acme CRM raised prices by 40%; DataPulse confirmed on G2 they use Acme.",
    intelligenceSummary:
      "Price disruption at a current competitor creates a displacement opportunity. Amara manages a team of 12 AEs and will feel the cost impact directly. Recommend leading with a cost-comparison ROI story in the first outreach.",
  },
];

async function main() {
  console.log("Seeding database...");
  for (const lead of seeds) {
    await prisma.lead.upsert({
      where: { email: lead.email },
      update: {},
      create: lead,
    });
  }
  console.log(`Seeded ${seeds.length} leads.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
