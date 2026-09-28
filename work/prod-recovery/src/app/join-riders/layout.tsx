import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Our Rider Team — Kozy Care",
  description: "Earn flexible income delivering clean laundry across Lagos. Apply to join the Kozy Care rider team.",
  robots: { index: true, follow: true },
};

export default function JoinRidersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
