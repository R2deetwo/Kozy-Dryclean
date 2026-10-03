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
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: 3 October 2026</p>
        <div className="space-y-6">
          <p className="text-sm text-[#6F88A8]">Kozy Care uses cookies to improve your experience. By using our site, you consent to cookies as described in our Privacy Policy.</p>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Types of Cookies &amp; Local Storage</h2>
            <div className="text-sm text-[#6F88A8] space-y-2">
              <p><strong>Essential cookies:</strong> a single sign-in cookie keeps you logged in (strictly necessary — the site cannot work without it).</p>
              <p><strong>Analytics:</strong> privacy-friendly, cookie-free aggregate pageview counts (Vercel Web Analytics). No cross-site tracking, no advertising cookies.</p>
              <p><strong>Local storage on your device:</strong> your chosen theme (light/dark), and — only while you are mid-booking — the basket and details you have typed, so a refresh or sign-in detour never loses your checkout. Clearing your browser data removes all of it.</p>
            </div></div>
          <p className="text-sm text-[#6F88A8]">You can manage cookie preferences through your browser settings. For questions, email kozygarmentcare@gmail.com.</p>
        </div>
      </div>
    </div>
  );
}
