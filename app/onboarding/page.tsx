import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";

export const metadata = {
  title: "Welcome to LeadIQ — Get Started",
  description: "Set up your LeadIQ workspace in under 2 minutes.",
};

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  // Must be authenticated
  if (!session?.user) {
    redirect("/auth/login");
  }

  return <OnboardingFlow />;
}
