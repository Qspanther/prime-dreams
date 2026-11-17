import type { Metadata, Viewport } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import WebSocketInitializer from "@/components/WebSocketInitializer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F0F4F9",
};

export const metadata: Metadata = {
  title: "Prime Dreams — Cricket Fantasy Sports Platform",
  description: "Play Cricket Fantasy Sports on Prime Dreams. Pick your 11-player squad across World Cup, T20, League, and Women's tournaments with guaranteed prizes.",
  keywords: "prime dreams, cricket fantasy, fantasy sports, cricket league, world cup fantasy, t20 fantasy",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Prime Dreams",
  },
  applicationName: "Prime Dreams",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased overflow-hidden h-full w-full bg-[#F0F4F9] text-[#0F172A]" suppressHydrationWarning>
        <WebSocketInitializer />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
