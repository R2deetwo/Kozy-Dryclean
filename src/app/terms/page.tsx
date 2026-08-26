import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Kozy Care",
  description: "Terms of Service for Kozy Care Drycleaning & Laundry Services.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-[#0A192F] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: August 2025</p>
        <div className="space-y-6">
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Company Information</h2>
            <p className="text-sm text-[#6F88A8]">Kozy Care Drycleaning &amp; Laundry Services<br/>Address: No 20, Westsyde Drive, Ogombo, Lagos State<br/>Email: kozygarmentcare@gmail.com<br/>Phone: +234 803 175 5230</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">1. Service Description</h2>
            <p className="text-sm text-[#6F88A8]">Kozy Care provides premium dry cleaning, laundry, pressing, and textile care services with pickup and delivery across Lagos Island. Services include per-item dry cleaning, weight-based corporate linen programs, sneaker restoration, and optional condition-capture photography.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">2. Order Placement</h2>
            <p className="text-sm text-[#6F88A8]">Orders may be placed via our website, mobile app, or by phone. An order is confirmed only after we send a confirmation message. We reserve the right to refuse service for garments we deem unsafe to process.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">3. Pickup &amp; Delivery</h2>
            <p className="text-sm text-[#6F88A8]">Customers must ensure garments are accessible during the scheduled pickup window. A missed pickup may incur a re-scheduling fee of ₦1,500. Standard delivery turnaround is 48 hours for retail orders.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">4. Pricing &amp; Payment</h2>
            <p className="text-sm text-[#6F88A8]">Retail pricing is per-item as listed on our website. Corporate pricing is per-kilogram with a 10kg minimum. Payment methods: Bank transfer, Paystack, or corporate invoice (Net-15). Orders are processed only after payment verification.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">5. Return-as-Received Guarantee</h2>
            <p className="text-sm text-[#6F88A8]">Activate by uploading condition photos during booking for a 5% discount. Covers physical damage in our care. Does NOT cover pre-existing wear, fabric degradation, or manufacturer defects. Claims within 24 hours of delivery. Maximum liability: 10x cleaning charge, up to ₦50,000 per garment.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">6. Lost or Damaged Items</h2>
            <p className="text-sm text-[#6F88A8]">All garments tagged at pickup with chain-of-custody tracking. Lost items: 72-hour search period. Compensation: 10x cleaning charge or depreciated value, up to ₦50,000. Not liable for items left in pockets or inherent fabric damage.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">7. Cancellation &amp; Refunds</h2>
            <p className="text-sm text-[#6F88A8]">Before pickup: free cancellation, full refund. After pickup, before processing: ₦1,500 fee. After processing: no refund. Store credit at our discretion for service complaints.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">8. Limitation of Liability</h2>
            <p className="text-sm text-[#6F88A8]">Total liability shall not exceed the amount paid for the specific order. Not liable for indirect, consequential, or punitive damages, or force majeure delays.</p></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">9. Governing Law</h2>
            <p className="text-sm text-[#6F88A8]">Governed by the laws of the Federal Republic of Nigeria. Disputes resolved through mediation in Lagos State, then Lagos State High Court.</p></div>
        </div>
      </div>
    </div>
  );
}
