import type { Metadata } from "next";

// /milestone — the private 10-order appreciation page reached from the
// customer's own email (HMAC token) or portal. No public discovery value.
export const metadata: Metadata = {
  title: "A quiet thank-you — Kozy Care",
  robots: { index: false, follow: false },
};

export default function MilestoneLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
