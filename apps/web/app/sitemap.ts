import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/api/server";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import type { CourseSummaryDto, Paginated } from "@skillstream/shared";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const STATIC_ROUTES = ["", "/courses", "/teach", "/login", "/signup"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  // Best-effort: an unreachable API shouldn't take the whole sitemap down,
  // just fall back to the static routes.
  let courseEntries: MetadataRoute.Sitemap = [];
  try {
    const page = await serverApi<Paginated<CourseSummaryDto>>(
      `/courses?pageSize=${MAX_PAGE_SIZE}`,
    );
    courseEntries = page.items.map((c) => ({
      url: `${SITE_URL}/courses/${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.9,
    }));
  } catch {
    /* fall back to static routes only */
  }

  return [...staticEntries, ...courseEntries];
}
