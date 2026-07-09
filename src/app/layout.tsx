import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar"
import { SpoilerProvider } from "@/contexts/SpoilerContext";
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
  metadataBase: new URL("https://ffxiv-hub.app"),
  title: {
    default: "FFXIV Daily Hub",
    template: "%s | FFXIV Daily Hub",
  },
  description:
    "Free fan-made tool for Final Fantasy XIV players. Track daily and weekly resets, Eorzea time, weather, beast tribes, custom deliveries and more — per character.",
  keywords: ["FFXIV", "Final Fantasy XIV", "daily reset", "weekly reset", "Eorzea time", "checklist", "tracker", "beast tribes"],
  openGraph: {
    type: "website",
    siteName: "FFXIV Daily Hub",
    title: "FFXIV Daily Hub",
    description: "Track your FFXIV dailies, weeklies, Eorzea time and weather — free, no ads.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FFXIV Daily Hub" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FFXIV Daily Hub",
    description: "Track your FFXIV dailies, weeklies, Eorzea time and weather — free, no ads.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SpoilerProvider>
          <ServiceWorkerRegistrar />
          <Navbar />
          {children}
        </SpoilerProvider>
      </body>
    </html>
  );
}
