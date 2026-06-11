import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Industrial Precision type system: Archivo (high-performance signage
// grotesque) for all UI, IBM Plex Mono for numbers, codes and barcodes.
// Variable names stay --font-display / --font-num so every existing
// font-[family-name:var(--font-…)] reference picks them up.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
