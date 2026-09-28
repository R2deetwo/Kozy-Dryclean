import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Kozy Care",
  description: "Sign in to your Kozy account to track orders and book pickups.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
