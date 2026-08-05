import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/instructor",
        "/dashboard",
        "/account",
        "/sales-agent",
        "/org",
        "/checkout",
        "/cart",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
