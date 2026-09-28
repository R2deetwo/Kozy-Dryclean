import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account — Kozy Care",
  description: "Get started with Kozy in 60 seconds. Premium dry cleaning & laundry pickup in Lagos.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
