import type { ReactNode } from "react";
import { ExtensionBoundary, PostPasswordForm } from "./client";
import { applyFilters, findBlock, findRegion, findShortcode, getActiveExtensions, getActiveTheme } from "./runtime";
import type { Block, Post, PostContentDoc, ResolveResult, Site } from "./types";
import { getPattern, getSite, getTemplates } from "./api";
import { CORE_BINDING_SOURCES } from "./bindings";
import { getT } from "./i18n";
import { renderDynamic } from "./dynamic";
import { renderContent, type RenderContext } from "./rich";
import { cx } from "./utils";

/**
 * Render nội dung bài viết (định dạng của CMS — @ecomcx/ecomweb-content; phần vẽ ở rich.tsx, không phụ thuộc trình soạn).
 * Luôn có class `ecx-content` (giao diện nền trong @ecomcx/ecomweb-content/style.css, theme ghi đè được); `className` thay cho `entry-content`.
 */
export async function PostContent({ post, content, className, page }: { post?: Post | null; content?: PostContentDoc | null; className?: string; page?: number }) {
  const site = await getSite();
  const doc = content ?? post?.content;
  if (!content && post?.passwordProtected && !post.content) {
    const t = await getT();
    return <div className={cx(className ?? "entry-content", "ecx-content")}><PostPasswordForm postId={post.id} labels={{ intro: t("password.intro"), label: t("password.label"), submit: t("password.submit"), wrong: t("password.wrong") }} /></div>;
  }
  if (!doc?.blocks?.length) return null;
  // 2 (v3): khối "Ngắt trang" đã bỏ — bài luôn hiện trên một trang (`page` giữ lại cho theme cũ, không còn tác dụng)
  void page;
  const rendered = await renderContent(doc, { ...(await contentContext(site, post)), source: post ? `post:${post.id}` : undefined }, async (blocks) => applyFilters("post.blocks", blocks, { site, post }, site));
  return <div className={cx(className ?? "entry-content", "ecx-content")}>{rendered}</div>;
}

/**
 * Vùng của theme: header, footer (vùng chuẩn của core — nên luôn bọc) và vùng hybrid khai báo ở theme.json › regions.
 * Thứ tự: plugin thay vùng (definePlugin → regions) → bản sửa trong Trình dựng / `parts/{name}.json` → `children` (bản code của theme).
 * `<EditableRegion name="header" data={data}><Header /></EditableRegion>`
 */
export async function EditableRegion({ name, data, className, children }: { name: string; data?: ResolveResult; className?: string; children?: ReactNode }) {
  const doc = (await getTemplates().catch(() => null))?.parts[name];
  const site = await getSite();
  const own = doc?.blocks?.length
    ? <div className={cx(`ecx-region ecx-region-${name}`, "ecx-content", className)}>{await renderContent(doc, { ...(await contentContext(site, data?.post, data)), source: `part:${name}` })}</div>
    : <>{children}</>;
  return <>{await regionOverride(name, own, site, data)}</>;
}

/** Plugin thay vùng: component nhận bản sẽ vẽ (`children`), lỗi chỉ ẩn vùng đó. */
async function regionOverride(name: string, fallback: ReactNode, site: Site, data?: ResolveResult): Promise<ReactNode> {
  const Region = await findRegion(name, site);
  if (!Region) return fallback;
  return <ExtensionBoundary name={`Region ${name}`}><Region name={name} site={site} data={data ?? null}>{fallback}</Region></ExtensionBoundary>;
}

/** Ngữ cảnh vẽ nội dung dùng chung cho bài viết và template khối. */
export async function contentContext(site: Site, post?: Post | null, data?: ResolveResult): Promise<RenderContext> {
  const t = await getT();
  // Bản nháp (xem trực tiếp / Trình dựng) không vào cache công khai → được gắn vị trí khối cho khung soạn
  const markBlocks = await import("next/headers").then(async ({ draftMode }) => (await draftMode()).isEnabled).catch(() => false);
  const extensions = await getActiveExtensions(site);
  const blocks = extensions.flatMap((d) => d.blockTypes ?? []);
  // Không plugin nào đăng ký "block.render" thì không tốn một lần gọi filter cho mỗi khối
  const hasBlockFilter = extensions.some((d) => (d.filters as Record<string, unknown> | undefined)?.["block.render"]);
  return {
    site, post, data, blocks, markBlocks,
    controls: extensions.flatMap((d) => d.blockControls ?? []),
    // Nhiều plugin cùng khai một loại khối → gộp danh sách thuộc tính
    ready: extensions.some((d) => d.readyBlocks) ? extensions.reduce<Record<string, string[]>>((m, d) => { for (const [k, v] of Object.entries(d.readyBlocks ?? {})) m[k] = [...new Set([...(m[k] ?? []), ...v])]; return m; }, {}) : undefined,
    assets: extensions.flatMap((d) => d.assets ?? []),
    filterBlock: hasBlockFilter ? (node, el) => applyFilters("block.render", el, { node, site, post }, site) : undefined,
    resolve: { shortcode: (name) => findShortcode(name, site), block: (type) => findBlock(type, site) },
    labels: { download: t("file.download"), toc: t("toc.title") },
    boundary: (name, key, el) => <ExtensionBoundary key={key} name={name}>{el}</ExtensionBoundary>,
    dynamic: renderDynamic,
    parts: async (slug) => (await getTemplates().catch(() => null))?.parts[slug] ?? null,
    region: (name, fallback) => regionOverride(name, fallback, site, data),
    // Khối mẫu đồng bộ lỗi (CMS lỗi) → ẩn khối đó, không làm sập cả bài
    pattern: (ref) => getPattern(ref).catch((e) => { console.error(`[ecomweb] pattern #${ref}:`, e); return null; }),
    binding: async (source, args, c) => {
      const fn = CORE_BINDING_SOURCES[source] ?? (await getActiveExtensions(site)).map((d) => d.bindingSources?.[source]).find(Boolean);
      // Bài của vòng lặp (query) / bài đang xem / bài của nội dung
      return fn ? fn(args, { site, post: c.post ?? post, data: c.data ?? data }) : undefined;
    },
  };
}

/**
 * Header / footer của theme dựng bằng khối cho template có sẵn của SDK (full-width, landing): theme khối không có header/footer
 * trong layout mà ở template part trong từng template khối → template có sẵn phải tự vẽ part "header" / "footer". Theme thường: null.
 */
export async function blockThemeParts(site: Site, data?: ResolveResult): Promise<[ReactNode, ReactNode]> {
  if ((await getActiveTheme(site)).chain[0]?.manifest.editing !== "blocks") return [null, null];
  const ctx = await contentContext(site, data?.post, data);
  const part = async (slug: string) => <>{await renderContent({ type: "doc", content: [{ type: "templatePart", attrs: { slug, tagName: slug } }] }, ctx)}</>;
  return [await part("header"), await part("footer")];
}
