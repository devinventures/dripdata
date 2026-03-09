import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DripData — Dividend Tools",
  description: "Real-time dividend calculators and portfolio trackers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* No-flash: set dark/light class before React hydrates */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('drip-theme');document.documentElement.classList.toggle('dark',!t||t==='dark');})()`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <ThemeProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
