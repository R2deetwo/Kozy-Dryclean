import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Portal — Kozy Drycleaning",
  description: "Track your orders, view invoices, and book new pickups.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
