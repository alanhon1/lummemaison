import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import PwaRegister from '@/components/pwa/PwaRegister';
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lumeemaison.com'),
  title: {
    default: "Lumée Maison — Premium Korean Aesthetic Cosmetics",
    template: "%s | Lumée Maison",
  },
  description:
    "B2B wholesale supplier of premium Korean medical-grade aesthetic products. Fillers, mesotherapy, botulinum, and more. Serving professionals worldwide.",
  keywords: ["korean cosmetics", "aesthetic products", "B2B wholesale", "fillers", "mesotherapy", "botulinum"],
  alternates: {
    canonical: 'https://lumeemaison.com',
  },
  openGraph: {
    type: "website",
    siteName: "Lumée Maison",
    url: 'https://lumeemaison.com',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Lumée Maison', statusBarStyle: 'default' },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3A342C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen flex flex-col">
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
