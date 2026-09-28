import type { Metadata } from "next";
import { ServicesPage } from "@/components/customer/services-page";

// =============================================================================
// /services — split out of the home page in phase 45; re-scoped in phase 64
// (pricing lives with the membership plans on /memberships) and phase 67
// (couture, designer and premium traditional wear is its own specialist
// SERVICE here — Couture Care — not a membership tier). BreadcrumbList
// structured data so search results can show Home > Specialty care.
// Price-SEO title lives on /memberships.
// =============================================================================

export const metadata: Metadata = {
  title: "Couture & Designer Garment Care, Sneaker Restoration & Alterations in Lagos | Kozy Care",
  description:
    "Specialist garment care from the Kozy atelier across Ikoyi, Lekki and Lagos Island: Couture Care for designer, couture and premium traditional wear — assessed, hand-finished and quoted per piece — plus sneaker and trainer restoration from ₦5,000 and in-house alterations and repairs. Free island-wide pickup and delivery.",
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
      name: "Specialty care",
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
