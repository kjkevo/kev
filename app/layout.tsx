import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/src/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Recover — Missed-Call Recovery",
  description:
    "Automatically text back customers who miss your call, and track every recovered lead and dollar.",
};

// Google Ads conversion tag (AW-18397518575). Loaded site-wide so every page
// view and conversion (trial signups, etc.) is visible back in Google Ads.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#080D1A] text-white antialiased">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18397518575"
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18397518575');
          `}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
