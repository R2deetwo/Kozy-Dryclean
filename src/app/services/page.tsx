import type { Metadata } from "next";
import { ServicesPage } from "@/components/customer/services-page";

export const metadata: Metadata = {
  title: "Services & Pricing — Kozy Care Drycleaning & Laundry, Lagos",
  description:
    "Per-item dry cleaning and laundry prices for men, women and the home, sneaker & trainer restoration from ₦5,000, in-house alterations, and per-kilogram corporate programs for hotels and estates across Lagos Island. Free first pickup and delivery.",
  alternates: { canonical: "/services" },
};

export default function Services() {
  return <ServicesPage />;
}
