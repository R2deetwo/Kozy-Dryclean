import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver App — Kozy Care",
  description: "Field operations: route view, pickups, and deliveries.",
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
