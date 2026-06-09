import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Chivo_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Friendly rounded display (Sortly-like) + numeric fonts.
const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
const chivoMono = Chivo_Mono({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "[PRODUCT_NAME] — WMS",
  description: "Gestión de almacén multi-tenant para recepción ciega de mercancía",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${chivoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
