import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ArrivalTracker } from "@/components/ArrivalTracker";
import { ActivityPing } from "@/components/ActivityPing";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Slimpse",
  description: "Live trivia for bars and events. No app, no login, just a phone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ArrivalTracker />
        <ActivityPing />
        {children}
        {/* Only the staging (test) site sets this, so it can never be
            mistaken for the live one players use at the bar. */}
        {process.env.NEXT_PUBLIC_STAGING === "1" && (
          <div className="fixed bottom-2 right-2 z-[100] pointer-events-none rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white shadow-lg">
            Test site
          </div>
        )}
      </body>
    </html>
  );
}
