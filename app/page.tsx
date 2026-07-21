import { redirect } from "next/navigation";

// The product's home is the dashboard.
export default function HomePage() {
  redirect("/dashboard");
}
