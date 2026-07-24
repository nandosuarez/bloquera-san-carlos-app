import type { Metadata, Viewport } from "next";
import { ClientRecovery } from "@/components/client-recovery";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloquera San Carlos",
  description: "Sistema interno para la ferreteria Bloquera San Carlos."
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#b1111b",
  width: "device-width"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <ClientRecovery />
        {children}
      </body>
    </html>
  );
}
