import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Kozy · Premium Dry Cleaning & Laundry Care in Lagos",
  description: "Uncompromising care. Exceptional convenience. Kozy is Lagos' premium dry cleaning & laundry service — from designer wear to corporate linens, picked up at your door.",
  keywords: ["Kozy", "dry cleaning Lagos", "laundry Lagos", "premium dry cleaning", "Ikoyi laundry", "Lekki laundry", "corporate laundry Lagos"],
  authors: [{ name: "Kozy" }],
  icons: {
    icon: "/kozy-mark.svg",
  },
  openGraph: {
    title: "Kozy · Premium Dry Cleaning & Laundry Care",
    description: "Uncompromising care. Exceptional convenience. Lagos' premium dry cleaning & laundry service.",
    siteName: "Kozy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kozy · Premium Dry Cleaning & Laundry Care",
    description: "Uncompromising care. Exceptional convenience.",
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
        className={`${outfit.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
