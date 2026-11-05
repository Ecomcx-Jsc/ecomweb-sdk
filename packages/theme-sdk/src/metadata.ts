import { applyFilters } from "./runtime";
import type { DocumentMetadata, ResolveResult, Site } from "./types";

/** Metadata mặc định cho trang + cho plugin (vd SEO) sửa qua filter "document.metadata". */
export async function buildDocumentMetadata(data: ResolveResult, site: Site): Promise<DocumentMetadata> {
  const isHome = data.kind === "home" || data.kind === "front-page";
  const base: DocumentMetadata = {
    title: isHome ? `${site.title}${site.tagline ? ` – ${site.tagline}` : ""}` : `${data.title} – ${site.title}`,
    description: data.post?.excerpt || (data.term?.description || undefined) || site.tagline,
    canonical: data.post?.link ? data.post.link + (Number(data.query?.trang) > 1 ? `?trang=${Math.floor(Number(data.query?.trang))}` : "") : (data.basePath || undefined),
    alternates: Object.fromEntries((data.alternates ?? []).map((a) => [a.locale, a.link])),
    openGraph: {
      title: data.post?.title ?? data.title,
      description: data.post?.excerpt || site.tagline,
      image: data.post?.featuredMedia?.sizes?.large?.url ?? data.post?.featuredMedia?.url,
      type: data.kind === "single" ? "article" : "website",
    },
  };
  if (data.kind === "404" || data.kind === "search" || data.noIndex) base.robots = "noindex";
  if (site.indexable === false) base.robots = "noindex, nofollow";
  const meta = await applyFilters("document.metadata", base, { site, data }, site);
  // Trang core/plugin khai báo noindex (đăng nhập, tài khoản, giỏ hàng) — plugin SEO không được mở index
  if (data.noIndex || site.indexable === false) meta.robots = site.indexable === false ? "noindex, nofollow" : "noindex, follow";
  return meta;
}
