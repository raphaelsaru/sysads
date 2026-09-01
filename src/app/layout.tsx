import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import ConnectionStatus from "@/components/auth/ConnectionStatus";
import AssistantFab from "@/components/assistant/AssistantFab";
import { Analytics } from '@vercel/analytics/react';

const instrumentSans = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "CRM Prizely - Sistema de Gestão de Clientes",
  description: "Sistema de CRM para gestão de clientes da Prizely",
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${instrumentSans.variable} ${fraunces.variable} antialiased`}>
        <AuthProvider>
          <AdminProvider>
            {children}
            <AssistantFab />
            <ConnectionStatus />
            <Analytics />
          </AdminProvider>
        </AuthProvider>
      </body>
    </html>
  );
}