import type { Post, ResolveResult, Site } from "./types";

/**
 * Gắn dữ liệu (@ecomcx/ecomweb-content 1.15 — `attrs.bindings`): thuộc tính của khối lấy giá trị lúc hiển thị.
 * Nguồn lõi: core/post (trường của bài đang vẽ / bài trong vòng lặp), core/post-meta (trường meta), core/site.
 * Plugin thêm nguồn: definePlugin({ bindingSources: { "shop/product": async (args, ctx) => … } }).
 */
export interface BindingContext { site: Site; post?: Post | null; data?: ResolveResult | null }
export type BindingSource = (args: Record<string, string | number | boolean>, ctx: BindingContext) => unknown | Promise<unknown>;

/** Thuộc tính gắn được của khối lõi: tên trong bindings → nơi đặt giá trị. */
export const BINDABLE: Record<string, readonly string[]> = {
  paragraph: ["content"], heading: ["content"], image: ["src", "alt", "caption"], button: ["text", "href"],
};

const scalar = (v: unknown) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : undefined);

export const CORE_BINDING_SOURCES: Record<string, BindingSource> = {
  "core/post": (args, { post }) => {
    if (!post) return undefined;
    switch (args.field) {
      case "title": return post.title;
      case "excerpt": return post.excerpt;
      case "date": return post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(post.locale || "vi") : undefined;
      case "author": return post.author?.name;
      case "link": return post.link;
      case "featuredImage": return post.featuredMedia?.url;
      default: return undefined;
    }
  },
  "core/post-meta": (args, { post }) => (typeof args.key === "string" && post?.meta ? scalar((post.meta as Record<string, unknown>)[args.key]) : undefined),
  "core/site": (args, { site }) => {
    switch (args.field) {
      case "title": return site.title;
      case "tagline": return site.tagline;
      case "url": return site.url;
      case "logo": return scalar((site.themeSettings as Record<string, { url?: string } | undefined>)?.logo?.url);
      default: return undefined;
    }
  },
};
