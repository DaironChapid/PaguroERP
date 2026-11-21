import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contabilidad · Paguro",
  description: "Módulo de contabilidad automatizada de Paguro Corp",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
