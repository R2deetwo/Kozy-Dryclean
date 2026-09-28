import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Kozy Care",
  description: "Refund and cancellation policy for Kozy Care.",
};

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-[#0A192F] mb-2">Refund &amp; Cancellation Policy</h1>
        <p className="text-sm text-[#6F88A8] mb-8">Effective Date: August 2025</p>
        <div className="space-y-6">
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Cancellations</h2>
            <div className="text-sm text-[#6F88A8] space-y-2">
              <p>Before pickup: Free cancellation, full refund.</p>
              <p>After pickup, before processing: ₦1,500 logistics fee, balance refunded.</p>
              <p>After processing begins: Non-cancellable, no refund.</p>
            </div></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">Refunds</h2>
            <div className="text-sm text-[#6F88A8] space-y-2">
              <p><strong>Overpayments:</strong> Refunded within 5-7 business days to original payment method.</p>
              <p><strong>Service Complaints:</strong> Store credit issued at our discretion after investigation.</p>
              <p><strong>Guarantee Claims:</strong> If approved, compensation as store credit or bank transfer within 10 business days.</p>
            </div></div>
          <div><h2 className="font-serif text-xl font-semibold mb-2 text-[#0A192F]">How to Cancel</h2>
            <p className="text-sm text-[#6F88A8]">Log into your portal → Orders → Cancel (if eligible), or call +234 803 175 5230.</p></div>
        </div>
      </div>
    </div>
  );
}
