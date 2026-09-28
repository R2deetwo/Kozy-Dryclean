import type { Metadata } from "next";

// /book is a public, sitemapped conversion page (priority 0.9) — phase 50
// gives it the local metadata it never had. Server layout wrapper: the page
// itself is 'use client' and cannot export metadata.
export const metadata: Metadata = {
  title: "Book a Laundry Pickup in Ikoyi or Lekki | Kozy Care",
  description:
    "Schedule your free pickup and delivery across Lagos Island — dry cleaning, laundry, shoe care and alterations in one booking. No account needed; checkout in minutes.",
  alternates: { canonical: "/book" },
};

export default function BookLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
