import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/shell/theme-provider";

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
  title: "Kozy Drycleaning and Laundry Services | Premium Pickup & Delivery in Lagos",
  description: "Uncompromising care. Exceptional convenience. Kozy Drycleaning and Laundry Services — Lagos' premium pickup & delivery for designer wear, corporate linens, and household items.",
  keywords: ["Kozy", "Kozy Drycleaning", "dry cleaning Lagos", "laundry Lagos", "premium dry cleaning", "Ikoyi laundry", "Lekki laundry", "corporate laundry Lagos", "laundry pickup Lagos"],
  authors: [{ name: "Kozy Drycleaning and Laundry Services" }],
  icons: {
    icon: "/kozy-mark.svg",
  },
  openGraph: {
    title: "Kozy Drycleaning and Laundry Services",
    description: "Uncompromising care. Exceptional convenience. Lagos' premium pickup & delivery service for designer wear and corporate linens.",
    siteName: "Kozy Drycleaning and Laundry Services",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kozy Drycleaning and Laundry Services",
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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
