import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/app/components/ThemeProvider";
import CommandPalette from "@/app/components/CommandPalette";
import KeyboardShortcuts from "@/app/components/KeyboardShortcuts";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeadIQ — B2B Lead Intelligence",
  description: "Find, qualify, and convert high-value B2B leads with AI-powered intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          {children}
          <CommandPalette />
          <KeyboardShortcuts />
        </ThemeProvider>
      </body>
    </html>
  );
}
