import { redirect } from "next/navigation";

// The product's home is the admin/client dashboard.
export default function HomePage() {
  redirect("/admin");
}
