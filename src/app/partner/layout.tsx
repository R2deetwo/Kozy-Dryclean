import type { Metadata, Viewport } from "next";

// Phase 72: the Kozy Network partner portal — mobile-first like the rider
// app (laundrette owners live on their phones at the folding table). Not
// indexed: it is a working console behind a login, not a marketing page.
export const metadata: Metadata = {
  title: "Kozy Partner — Kozy Care",
  description:
    "The Kozy Network partner portal: the orders routed to your laundry, your revenue-share ledger and your account.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
