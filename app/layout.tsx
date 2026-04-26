import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getAllPosts } from "@/lib/blog";
import { SearchProvider } from "@/components/SearchContext";
import SearchModal from "@/components/SearchModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Security Playbook",
  description: "A comprehensive guide to frontend security best practices",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const allPosts = getAllPosts();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SearchProvider>
            {children}
            <SearchModal posts={allPosts} />
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
