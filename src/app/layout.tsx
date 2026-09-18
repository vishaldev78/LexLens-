import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/components/lexlens/language-provider";
import { ReminderWatcher } from "@/components/lexlens/reminder-watcher";
import { SiteHeader } from "@/components/lexlens/site-header";
import { SiteFooter } from "@/components/lexlens/site-footer";

// Primary UI font — Poppins (user's choice). Devanagari/Chinese fall through to
// the visitor's system fonts via the CSS stack (standard production practice).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LexLens — Any legal notice. Any language. Understood in 60 seconds.",
  description:
    "AI-powered legal notice intelligence: upload any legal notice and get a plain-language, citation-verified breakdown — sender, demands, deadlines, severity and your rights — in English, Hindi, Chinese and French.",
  keywords: [
    "LexLens",
    "legal notice",
    "legal information",
    "legal-tech",
    "FDCPA",
    "NI Act 138",
    "multilingual legal AI",
    "access to justice",
  ],
  authors: [{ name: "LexLens" }],
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    title: "LexLens — Legal Notice Intelligence",
    description: "Any legal notice. Any language. Understood in 60 seconds.",
    siteName: "LexLens",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased bg-white text-slate-900 flex min-h-screen flex-col`}>
        <LanguageProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <ReminderWatcher />
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
