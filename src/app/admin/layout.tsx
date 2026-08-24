import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atelier Console — Kozy Drycleaning",
  description: "Admin dashboard for order management, payments, and operations.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
