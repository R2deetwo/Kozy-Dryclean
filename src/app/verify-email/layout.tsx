import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Email — Kozy Drycleaning",
  description: "Verify your email address to activate your Kozy account.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
