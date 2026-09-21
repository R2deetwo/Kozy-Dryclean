import type { Metadata } from "next";
import { ServicesPage } from "@/components/customer/services-page";

// =============================================================================
// /services — split out of the home page in phase 45. Phase 50: local-SEO
// title/description (Ikoyi/Lekki price searches) + BreadcrumbList structured
// data so search results can show Home > Services & pricing.
// =============================================================================

export const metadata: Metadata = {
  title: "Dry Cleaning & Laundry Prices in Ikoyi & Lekki | Kozy Care",
  description:
    "See every price before you book: per-item dry cleaning and laundry for men, women and the home, sneaker & trainer restoration from ₦5,000, in-house alterations, and per-kilogram corporate programs for hotels and estates across Ikoyi, Lekki and Lagos Island. Free first pickup and delivery.",
  alternates: { canonical: "/services" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://kozycare.ng",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Services & pricing",
      item: "https://kozycare.ng/services",
    },
  ],
};

export default function Services() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ServicesPage />
    </>
  );
}
