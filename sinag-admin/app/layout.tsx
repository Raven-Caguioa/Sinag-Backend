// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SuiProvider } from "@/components/providers/SuiProvider";
import { AdminLayout } from "@/components/layout/AdminLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sinag Admin - RWA Resort Platform",
  description: "Admin dashboard for Sinag Protocol campaign management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <SuiProvider>
          <AdminLayout>{children}</AdminLayout>
        </SuiProvider>
      </body>
    </html>
  );
}