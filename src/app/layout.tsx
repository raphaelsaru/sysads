import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import ConnectionStatus from "@/components/auth/ConnectionStatus";
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Prizely - Sistema de Gestão de Clientes",
  description: "Sistema de CRM para gestão de clientes da Prizely",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <AdminProvider>
            {children}
            <ConnectionStatus />
            <Analytics />
          </AdminProvider>
        </AuthProvider>
      </body>
    </html>
  );
}