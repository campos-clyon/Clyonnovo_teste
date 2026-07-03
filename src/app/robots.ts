import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/painel/",
          "/_next/",
          "/colaboradores/",
          "/colaboradores",
          "/auth/",
          "/auth",
        ],
      },
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
      },
      {
        userAgent: ["facebookexternalhit", "Twitterbot", "LinkedInBot", "WhatsApp"],
        allow: "/",
      },
    ],
    sitemap: "https://clyon.pt/sitemap.xml",
    host: "https://clyon.pt",
  };
}
