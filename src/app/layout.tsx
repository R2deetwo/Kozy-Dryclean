import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { QueryProvider } from "@/components/shell/query-provider";
import { SessionProviderWrapper } from "@/components/shell/session-provider";

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
  metadataBase: new URL("https://kozycare.ng"),
  title: "Kozy Care — Premium Drycleaning & Laundry Services in Lagos",
  description: "Uncompromising care. Exceptional convenience. Kozy Care — Lagos' premium dry cleaning & laundry pickup and delivery service.",
  keywords: ["Kozy Care", "dry cleaning Lagos", "laundry Lagos", "premium dry cleaning", "Ikoyi laundry", "Lekki laundry", "corporate laundry Lagos", "laundry pickup Lagos"],
  authors: [{ name: "Kozy Care" }],
  alternates: {
    canonical: "https://kozycare.ng",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "icon", url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Kozy Care — Premium Drycleaning & Laundry Services",
    description: "Uncompromising care. Exceptional convenience.",
    url: "https://kozycare.ng",
    siteName: "Kozy Care",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kozy Care — Premium Drycleaning & Laundry Services",
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
      <head>
        {/* Set theme class before hydration to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('kozy-theme')||'light';if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})()` }} />
      </head>
      <body
        className={`${outfit.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <SessionProviderWrapper>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
