import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No ignoreBuildErrors — surface real type errors at build time.
  // No ignoreDuringBuilds for ESLint — same principle.
  reactStrictMode: true,

  // Security headers — applied to every response.
  // Vercel respects these (unlike the deleted Caddyfile which was sandbox-only).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          // CSP — see ARCHITECTURE.md for the external-domain allowlist rationale.
          // Tightened to only allow what the app actually uses.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js needs inline scripts for hydration + style attributes
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Tailwind generates inline styles + style attributes on elements
              "style-src 'self' 'unsafe-inline'",
              // Fonts loaded via next/font (self-hosted) + Google Fonts fallback
              "font-src 'self' data:",
              // Images: self (logos/icons), data: (base64), https: (R2 uploads, Supabase, Unsplash if used)
              "img-src 'self' data: https:",
              // Connect: self (API routes), Supabase, Paystack (in production)
              "connect-src 'self' https://*.supabase.co https://api.paystack.co",
              // Form actions: self only (Paystack uses fetch, not form posts)
              "form-action 'self'",
              // Frames: deny by default (Paystack inline uses an iframe in prod — add when wired)
              "frame-ancestors 'none'",
              // Base URI: lock to self
              "base-uri 'self'",
              // Object/embed: deny
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
