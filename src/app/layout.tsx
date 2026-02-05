import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/layout/Header";
import QueryProvider from "@/components/providers/QueryProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "교회 자원 관리 시스템 StewardFlow",
  description: "교회 자원 관리 시스템 StewardFlow",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.json",
  themeColor: "#234689",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StewardFlow",
  },
  openGraph: {
    title: "교회 자원 관리 시스템 StewardFlow",
    description: "교회 자원 관리 시스템 StewardFlow",
    url: "https://steward-flow.vercel.app",
    siteName: "StewardFlow",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "StewardFlow - 교회 자원 관리 시스템",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "교회 자원 관리 시스템 StewardFlow",
    description: "교회 자원 관리 시스템 StewardFlow",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <div className="min-h-screen bg-neutral-50 text-neutral-900">
            <Header />
            <main className="mx-auto w-full max-w-5xl px-4 py-8">
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
