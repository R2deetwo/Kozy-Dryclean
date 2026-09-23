import type { Metadata } from "next";

// /payment/* — checkout return screens (Paystack callback, bank-transfer
// pending). Transactional app pages: keep out of the index.
export const metadata: Metadata = {
  title: "Payment — Kozy Care",
  robots: { index: false, follow: false },
};

export default function PaymentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
