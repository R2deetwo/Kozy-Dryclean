import type { MetadataRoute } from 'next'

// =============================================================================
// Sitemap — served automatically at /sitemap.xml by Next.js App Router.
// robots.txt already points at https://kozycare.ng/sitemap.xml.
//
// Only public, indexable marketing pages are listed. App pages (/portal,
// /admin, /driver, /review, /api) are disallowed in robots.txt and excluded
// here on purpose.
// =============================================================================
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://kozycare.ng'
  const now = new Date()

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/join-riders`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/refunds`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
