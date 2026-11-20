import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DevelopmentBanner } from "@/components/layout/DevelopmentBanner";

export const metadata: Metadata = {
  title: "Support Group Roster Management | BMC Helix ITSM 26.2",
  description: "External Roster Management and Assignment Availability Integration for BMC Helix ITSM 26.2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <DevelopmentBanner />
        <Navbar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
