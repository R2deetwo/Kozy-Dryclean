import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Kozy Care",
  description: "Privacy Policy for Kozy Care Drycleaning & Laundry Services. NDPR compliant.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-[#0A192F] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: 3 October 2026</p>
        <div className="space-y-6">
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Controller</h2>
            <p className="text-sm text-[#6F88A8]">Kozy Care Drycleaning &amp; Laundry Services<br/>No 20, Westsyde Drive, Ogombo, Lagos State<br/>kozygarmentcare@gmail.com · +234 803 175 5230</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Information We Collect</h2>
            <p className="text-sm text-[#6F88A8]"><strong>Personal:</strong> Name, email, phone, delivery addresses, company name (corporate clients).<br/><strong>Order:</strong> Garment descriptions, condition photos, order history, care instructions.<br/><strong>Technical:</strong> IP address, browser type, device info, cookies, analytics.<br/><strong>Payment:</strong> Processed via Paystack — we do not store card details.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">How We Use Your Data</h2>
            <p className="text-sm text-[#6F88A8]">Process and fulfill orders (contractual necessity), send order updates (legitimate interest), verify payments and prevent fraud (legal obligation), improve our services (legitimate interest). Marketing only with explicit consent.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Emails You Can Expect</h2>
            <p className="text-sm text-[#6F88A8]"><strong>Transactional:</strong> order confirmations, pickup and delivery updates, payment receipts — sent because you placed the order.<br/><strong>Membership relationship:</strong> if you hold a Kozy Circle plan, a monthly summary and renewal reminders arrive near your cycle end; cancellation stops them.<br/><strong>Newsletter &amp; offers:</strong> only if you subscribe (one-click unsubscribe in every email).<br/><strong>Review invitations:</strong> after a delivery we may invite you to review us on Google — at most one per delivery, at least 30 days apart, and never again once you have reviewed us or tap &ldquo;never ask again&rdquo; (a one-tap link in every invitation).<br/><strong>Occasional plan suggestions:</strong> if your recent laundry spend would fit a membership, we may email you about it at most monthly; these sends are capped, can be paused entirely, and never affect your service.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Reviews, Google &amp; WhatsApp</h2>
            <p className="text-sm text-[#6F88A8]">Public reviews are collected on our <strong>Google Business Profile</strong> — reviews you leave there are governed by Google&apos;s terms, and our website displays a selection of them (with the author name Google shows) on our testimonials section. Private feedback sent through our feedback page goes only to our team. Our WhatsApp buttons open a chat with our business number in your own WhatsApp app — we do not read or store your WhatsApp messages on this website.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Sharing</h2>
            <p className="text-sm text-[#6F88A8]">We do NOT sell your data. We share only with: Paystack (payments), SMS providers (notifications), Vercel (hosting), and legal authorities when required by law.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Security</h2>
            <p className="text-sm text-[#6F88A8]">Data stored on managed cloud infrastructure (Supabase for the database, Vercel for hosting), encrypted in transit (TLS) and at rest. Access restricted to authorised personnel. Garment condition photos are deleted automatically 90 days after delivery.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Your Rights (NDPR)</h2>
            <p className="text-sm text-[#6F88A8]">Access, Rectification, Erasure, Restriction, Portability, Objection, Withdraw Consent. To exercise these rights, email kozygarmentcare@gmail.com with subject "Data Subject Request."</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Retention</h2>
            <p className="text-sm text-[#6F88A8]">Account: until deletion + 2 years. Order history: 7 years (tax). Payment records: 7 years. Garment photos: 90 days post-delivery. Server logs: 12 months.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Breach Notification</h2>
            <p className="text-sm text-[#6F88A8]">In the event of a data breach: notify the Nigeria Data Protection Bureau within 72 hours, notify affected customers without undue delay, take immediate remediation steps.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Children's Privacy</h2>
            <p className="text-sm text-[#6F88A8]">Our services are not directed to children under 16. We do not knowingly collect data from children.</p></div>
        </div>
      </div>
    </div>
  );
}
