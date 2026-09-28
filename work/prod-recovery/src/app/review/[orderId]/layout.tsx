import type { Metadata } from "next";

// /review/[orderId] — private order-review form reached from customers' own
// emails/SMS. No public discovery value: keep out of the index.
export const metadata: Metadata = {
  title: "Leave a Review — Kozy Care",
  robots: { index: false, follow: false },
};

export default function ReviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
