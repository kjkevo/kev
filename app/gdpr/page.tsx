import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import GdprClient from "./GdprClient";

export const metadata = {
  title: "Your Data Rights — LeadIQ",
  description: "Manage your personal data, download exports, or delete your account",
};

export default async function GdprPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            &larr; Dashboard
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Data Rights</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your personal data in accordance with GDPR.{" "}
            <Link href="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">
              Read our Privacy Policy
            </Link>
          </p>
        </div>
        <GdprClient />
      </div>
    </div>
  );
}
