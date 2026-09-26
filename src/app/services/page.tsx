import type { Metadata } from "next";
import { ServicesPage } from "@/components/customer/services-page";

// =============================================================================
// /services — split out of the home page in phase 45; re-scoped in phase 64:
// pricing now lives with the membership plans on /memberships, so this page
// is the specialty-care story (atelier, sneaker restoration, alterations).
// BreadcrumbList structured data so search results can show
// Home > Specialty care. Price-SEO title moved to /memberships.
// =============================================================================

export const metadata: Metadata = {
  title: "Sneaker Restoration, Alterations & Atelier Care in Lagos | Kozy Care",
  description:
    "Specialty garment care from the Kozy atelier across Ikoyi, Lekki and Lagos Island: sneaker and trainer restoration from ₦5,000, in-house alterations and repairs by our seamstress, and a look inside the studio. Free island-wide pickup and delivery.",
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
