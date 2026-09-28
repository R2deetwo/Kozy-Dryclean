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
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: August 2025</p>
        <div className="space-y-6">
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Controller</h2>
            <p className="text-sm text-[#6F88A8]">Kozy Care Drycleaning &amp; Laundry Services<br/>No 20, Westsyde Drive, Ogombo, Lagos State<br/>kozygarmentcare@gmail.com · +234 803 175 5230</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Information We Collect</h2>
            <p className="text-sm text-[#6F88A8]"><strong>Personal:</strong> Name, email, phone, delivery addresses, company name (corporate clients).<br/><strong>Order:</strong> Garment descriptions, condition photos, order history, care instructions.<br/><strong>Technical:</strong> IP address, browser type, device info, cookies, analytics.<br/><strong>Payment:</strong> Processed via Paystack — we do not store card details.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">How We Use Your Data</h2>
            <p className="text-sm text-[#6F88A8]">Process and fulfill orders (contractual necessity), send order updates (legitimate interest), verify payments and prevent fraud (legal obligation), improve our services (legitimate interest). Marketing only with explicit consent.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Sharing</h2>
            <p className="text-sm text-[#6F88A8]">We do NOT sell your data. We share only with: Paystack (payments), SMS providers (notifications), Vercel (hosting), and legal authorities when required by law.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Data Security</h2>
            <p className="text-sm text-[#6F88A8]">Data stored on secure servers (Supabase, EU region). TLS 1.3 for transmission, AES-256 at rest. Access restricted to authorised personnel. Garment photos deleted 90 days post-delivery.</p></div>
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
