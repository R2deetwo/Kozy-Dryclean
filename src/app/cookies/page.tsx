import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — Kozy Care",
  description: "Cookie policy for Kozy Care.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-[#0A192F] mb-2">Cookie Policy</h1>
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: August 2025</p>
        <div className="space-y-6">
          <p className="text-sm text-[#6F88A8]">Kozy Care uses cookies to improve your experience. By using our site, you consent to cookies as described in our Privacy Policy.</p>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Types of Cookies</h2>
            <div className="text-sm text-[#6F88A8] space-y-2">
              <p><strong>Essential:</strong> Required for login, booking, and checkout.</p>
              <p><strong>Analytics:</strong> Helps us understand site usage (Google Analytics).</p>
              <p><strong>Preferences:</strong> Remembers your settings (theme, language).</p>
            </div></div>
          <p className="text-sm text-[#6F88A8]">You can manage cookie preferences through your browser settings. For questions, email kozygarmentcare@gmail.com.</p>
        </div>
      </div>
    </div>
  );
}
