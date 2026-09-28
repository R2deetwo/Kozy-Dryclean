import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/driver/service-worker-register";

// Phase 61: the rider app is an installable PWA (Add to Home Screen / the
// install prompt in Account). The manifest reuses the existing brand icons —
// no new assets, no brand changes — and scopes the installed app to /driver
// so a rider's home-screen icon opens straight onto their route.
export const metadata: Metadata = {
  title: "Kozy Rider — Kozy Care",
  description: "The Kozy Care rider app: today's route, stop details, history and earnings.",
  robots: { index: false, follow: false },
  manifest: "/manifest-driver.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegister />
    </>
  );
}
