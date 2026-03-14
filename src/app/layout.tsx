import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DripData — Dividend Tools",
  description: "Real-time yield calculators, ETF deep-dives, and portfolio tracking — built for income investors.",
  metadataBase: new URL("https://dripdata.co"),
  openGraph: {
    title: "DripData — Dividend Tools",
    description: "Real-time yield calculators, ETF deep-dives, and portfolio tracking — built for income investors.",
    url: "https://dripdata.co",
    siteName: "DripData",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DripData — Dividend Tools",
    description: "Real-time yield calculators, ETF deep-dives, and portfolio tracking — built for income investors.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* No-flash: set dark/light class before React hydrates */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('drip-theme');document.documentElement.classList.toggle('dark',t==='dark');})()`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col`}>
        <ThemeProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
