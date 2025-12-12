import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Atom",
  description: "Your Self-Hosted Start Page",
};

import { StatusProvider } from '@/context/StatusContext';
import { ConfigProvider } from '@/context/ConfigContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.variable} suppressHydrationWarning>
        <ThemeProvider>
          <ConfigProvider>
            <StatusProvider>
              {children}
              <Toaster position="bottom-right" theme="system" />
            </StatusProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
