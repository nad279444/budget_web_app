import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Wealth - AI-powered budgeting",
  description:
    "Track, analyze, and optimize your spending with an AI money coach.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo-sm.png" sizes="any" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Toaster richColors />

        <footer className="border-t border-border/70 bg-secondary text-secondary-foreground">
          <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-10 text-center text-sm sm:flex-row sm:text-left">
            <p className="font-medium">
              Wealth - manage your finances with intelligence.
            </p>
            <p className="text-secondary-foreground/70">
              Made with care by Nad
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
