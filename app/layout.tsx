import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloquera San Carlos",
  description: "Sistema interno para la ferreteria Bloquera San Carlos."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
