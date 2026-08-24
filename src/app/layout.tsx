import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lagos Fresh Laundry · Dry Cleaning & Laundry Pickup in Lagos",
  description: "Modern laundry & dry cleaning for individuals and businesses across Lagos. Book a pickup in 60 seconds, track every stage, pay by bank transfer or Paystack.",
  keywords: ["laundry Lagos", "dry cleaning Lagos", "laundry pickup Lagos", "laundry delivery Lagos", "corporate laundry", "B2B laundry"],
  authors: [{ name: "Lagos Fresh Laundry" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Lagos Fresh Laundry",
    description: "Lagos' freshest laundry & dry cleaning, picked up at your door.",
    siteName: "Lagos Fresh Laundry",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lagos Fresh Laundry",
    description: "Lagos' freshest laundry & dry cleaning, picked up at your door.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
