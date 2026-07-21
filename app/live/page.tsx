import { redirect } from "next/navigation";

// /live was the original dashboard route; it now lives at /dashboard.
export default function LiveRedirect() {
  redirect("/dashboard");
}
