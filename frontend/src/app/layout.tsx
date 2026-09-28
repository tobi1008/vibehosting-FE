import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/lib/ProjectContext";
import Providers from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibe Hosting Dashboard",
  description: "Deploy and manage your projects with Vibe Hosting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col text-foreground bg-background">
        <Providers>
          <ProjectProvider>
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </ProjectProvider>
        </Providers>
      </body>
    </html>
  );
}
