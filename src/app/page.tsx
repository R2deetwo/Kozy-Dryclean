import type { Metadata } from "next";
import { HomeClient } from "@/components/customer/home-client";
import {
  GOOGLE_BUSINESS,
  GOOGLE_MAPS_URL,
  openingHoursSpecification,
} from "@/lib/local-seo";

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
// emit from the page itself. Since the owner's Google Business Profile went
// live (Oct 2026), every local field here mirrors that listing EXACTLY
// (street address, geo, hours, Maps URL) via src/lib/local-seo.ts — NAP
// consistency between GBP and website is a top local-ranking factor.
// Still honest: no aggregateRating markup (zero Google reviews yet — the
// 4.9/5.0 trust-bar stat is marketing copy; marking it up risks a
// structured-data spam flag). Ratings belong on the Google Business
// Profile, where they are verifiable — collect them there via the footer's
// review link.
const businessSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "DryCleaner",
      "@id": "https://kozycare.ng/#business",
      name: "Kozy Care",
      description:
        "Premium dry cleaning and laundry pickup-and-delivery service serving Ikoyi, Lekki and Lagos Island. Per-item dry cleaning, wash-and-fold laundry, iron-only pressing, sneaker restoration, alterations and corporate linen programs.",
      url: "https://kozycare.ng",
      telephone: GOOGLE_BUSINESS.phone,
      priceRange: "₦₦",
      image: "https://kozycare.ng/brand/images/hero-pressed-shirts.png",
      logo: "https://kozycare.ng/brand/kozy-mark.svg",
      // The listing's home base — matches the footer and the Google listing.
      address: {
        "@type": "PostalAddress",
        streetAddress: GOOGLE_BUSINESS.address.street,
        addressLocality: `${GOOGLE_BUSINESS.address.locality}, ${GOOGLE_BUSINESS.address.region}`,
        postalCode: GOOGLE_BUSINESS.address.postal,
        addressRegion: GOOGLE_BUSINESS.address.region,
        addressCountry: GOOGLE_BUSINESS.address.country,
      },
      // Exact coordinates from the listing — no more city-level vagueness.
      geo: {
        "@type": "GeoCoordinates",
        latitude: GOOGLE_BUSINESS.geo.latitude,
        longitude: GOOGLE_BUSINESS.geo.longitude,
      },
      // Deep link to the live Google Maps listing (also in sameAs below).
      hasMap: GOOGLE_MAPS_URL,
      // The Google Business Profile is the business's one real web profile
      // today — declare it so the site entity and the Maps entity connect.
      sameAs: [GOOGLE_MAPS_URL],
      // Mirrored from the listing's opening hours (see local-seo.ts).
      openingHoursSpecification: openingHoursSpecification(),
      areaServed: [
        { "@type": "Place", name: "Ikoyi, Lagos" },
        { "@type": "Place", name: "Lekki, Lagos" },
        { "@type": "Place", name: "Lagos Island, Nigeria" },
      ],
      // The service menu, in Google's own vocabulary — helps the listing's
      // services and rich results line up with what the site actually sells.
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Kozy Care services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Dry cleaning & laundry",
              description:
                "Per-item dry cleaning, wash-and-fold and iron-only pressing with free pickup and delivery across Lagos Island.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Laundry membership plans",
              description:
                "The Kozy Circle — weekly pickup plans sized by household: one, three or five people, with bed-sheet and duvet perks.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Sneaker & shoe restoration",
              description:
                "Cleaning, deodorising and restoration for sneakers, suede and leather shoes.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Alterations & repairs",
              description:
                "In-house seamstress for hemming, resizing and repairs, exclusive to Kozy.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Couture & designer care",
              description:
                "Hand-finished care for couture, designer and premium traditional wear, quoted per piece.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Corporate linen programs",
              description:
                "Per-kg laundry programs for hotels, restaurants and offices across Lagos.",
            },
          },
        ],
      },
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
