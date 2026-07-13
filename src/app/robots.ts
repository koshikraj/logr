import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawler policy: public surfaces are open; auth-gated and API routes are not.
// Per-profile indexability (unclaimed seeded profiles) is handled by robots
// metadata on the page itself, not here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/welcome", "/login", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
