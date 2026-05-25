import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/src/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Pulse — AI-Powered Lead Generation",
  description:
    "Find and close your ideal customers with AI-powered ICP matching and personalized outreach.",
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
