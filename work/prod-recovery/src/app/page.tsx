import type { Metadata } from "next";
import { HomeClient } from "@/components/customer/home-client";

// =============================================================================
// Home route — SERVER component (phase 50) so the highest-value page on the
// site can carry local-SEO metadata + LocalBusiness structured data. The
// interactive body lives in HomeClient ('use client' pages cannot export
// metadata).
//
// Local targeting: the service area is Lagos Island — Ikoyi through Lekki
// (per the site's own copy: "Serving Ikoyi to Lekki", "island-wide"). Titles
// lead with what Lekki/Ikoyi residents actually search, brand last.
// =============================================================================

export const metadata: Metadata = {
  title: "Dry Cleaning & Laundry Services in Ikoyi & Lekki, Lagos | Kozy Care",
  description:
    "Dry cleaning & laundry pickup and delivery across Ikoyi, Lekki and Lagos Island. Atelier-grade care, 24-hour express, free first pickup — book in two minutes.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Kozy Care — Dry Cleaning & Laundry in Ikoyi & Lekki, Lagos",
    description:
      "Premium pickup-and-delivery dry cleaning across Ikoyi, Lekki and Lagos Island. Free first pickup; book in two minutes.",
    url: "/",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kozy Care — Dry Cleaning & Laundry in Ikoyi & Lekki, Lagos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kozy Care — Dry Cleaning & Laundry in Ikoyi & Lekki, Lagos",
    description:
      "Premium pickup-and-delivery dry cleaning across Lagos Island. Free first pickup; book in two minutes.",
    images: ["/brand/og-image.png"],
  },
};

// LocalBusiness structured data — the strongest local-ranking signal we can
// emit from the page itself. Honest fields only:
// - Service-area business: city-level address + areaServed (no fake street
//   address, no invented geo coordinates).
// - No openingHours (not published anywhere on the site).
// - No aggregateRating markup: the 4.9/5.0 trust-bar stat is marketing copy
//   and the carousel reviews are unaggregated — marking them up risks a
//   structured-data spam flag. Ratings belong on the (future) Google
//   Business Profile, where they are verifiable.
const businessSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "DryCleaner",
      "@id": "https://kozycare.ng/#business",
      name: "Kozy Care",
      description:
        "Premium dry cleaning and laundry pickup-and-delivery service serving Ikoyi, Lekki and Lagos Island. Per-item dry cleaning, wash-and-fold laundry, sneaker restoration, alterations and corporate linen programs.",
      url: "https://kozycare.ng",
      telephone: "+2348031755230",
      priceRange: "₦₦",
      image: "https://kozycare.ng/brand/images/hero-pressed-shirts.png",
      logo: "https://kozycare.ng/brand/kozy-mark.svg",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressRegion: "Lagos",
        addressCountry: "NG",
      },
      areaServed: [
        { "@type": "Place", name: "Ikoyi, Lagos" },
        { "@type": "Place", name: "Lekki, Lagos" },
        { "@type": "Place", name: "Lagos Island, Nigeria" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://kozycare.ng/#website",
      url: "https://kozycare.ng",
      name: "Kozy Care",
      description:
        "Dry cleaning & laundry pickup and delivery in Ikoyi and Lekki, Lagos.",
      publisher: { "@id": "https://kozycare.ng/#business" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <HomeClient />
    </>
  );
}
