import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
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
  title: {
    default: "Lumière — Premium Korean Aesthetic Cosmetics",
    template: "%s | Lumière",
  },
  description:
    "B2B wholesale supplier of premium Korean medical-grade aesthetic products. Fillers, mesotherapy, botulinum, and more. Serving professionals worldwide.",
  keywords: ["korean cosmetics", "aesthetic products", "B2B wholesale", "fillers", "mesotherapy", "botulinum"],
  openGraph: {
    type: "website",
    siteName: "Lumière",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`${cormorant.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
