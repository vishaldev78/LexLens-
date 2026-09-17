import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LexLens — Any legal notice. Any language. Understood in 60 seconds.",
  description:
    "AI-powered legal notice intelligence: upload any legal notice and get a plain-language, citation-verified breakdown — sender, demands, deadlines, severity and your rights — in English, Hindi or Spanish.",
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
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
