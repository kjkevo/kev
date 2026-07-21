import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/src/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Recover — Missed-Call Recovery",
  description:
    "Automatically text back customers who miss your call, and track every recovered lead and dollar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#080D1A] text-white antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
