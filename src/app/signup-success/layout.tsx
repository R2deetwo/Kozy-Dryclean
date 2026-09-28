import type { Metadata } from "next";

// The conversion landing page for a completed signup form submission. It is
// deliberately NOT indexable: it has no content value for searchers, and a
// URL that only exists after a form submit should never compete with /signup
// in the index. (robots.txt also disallows it — belt and braces, because
// robots.txt alone still lets the URL be listed without content.)
export const metadata: Metadata = {
  title: "Account created — check your email — Kozy Care",
  description:
    "Your Kozy Care account is created. Check your email for the verification link to activate it.",
  robots: { index: false, follow: false },
};

export default function SignupSuccessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
