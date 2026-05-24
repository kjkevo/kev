import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import SecurityClient from "./SecurityClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const userId = parseInt(session.user.id, 10);

  const { data: user } = await supabase
    .from("User")
    .select("twoFactorEnabled")
    .eq("id", userId)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <SecurityClient initialStatus={{ enabled: user?.twoFactorEnabled ?? false }} />
    </div>
  );
}
