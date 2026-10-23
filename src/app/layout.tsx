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

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('vibe_theme');
    var mode = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'dark';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col text-foreground bg-background transition-colors duration-200">
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
