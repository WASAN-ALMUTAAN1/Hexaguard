import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Poppins } from "next/font/google";

import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "HEXAGUARD AI | Security Console",
  description: "AI Red Teaming and Blue Teaming Platform for Secure AI Deployment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${jetBrainsMono.variable} overflow-x-hidden bg-[#1f2122] font-sans text-white antialiased`}
      >
        <AuthGate>
          <div className="hxg-background min-h-screen">
            <Sidebar />

            <div className="min-w-0">{children}</div>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}