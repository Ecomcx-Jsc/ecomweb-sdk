import type { ReactNode } from "react";
import { ExtensionBoundary, PostPasswordForm } from "./client";
import { applyFilters, findBlock, findRegion, findShortcode, getActiveExtensions } from "./runtime";
import type { Post, PostContentDoc, ResolveResult, Site } from "./types";
import { getPattern, getSite, getTemplates } from "./api";
import { getT } from "./i18n";
import { renderDynamic } from "./dynamic";
import { renderContent, type RenderContext } from "./rich";
import { cx } from "./utils";

/**
 * Render nội dung bài viết (định dạng của CMS — @ecomcx/ecomweb-content; phần vẽ ở rich.tsx, không phụ thuộc trình soạn).
 * Luôn có class `ecx-content` (giao diện nền trong @ecomcx/ecomweb-content/style.css, theme ghi đè được); `className` thay cho `entry-content`.
 */
export async function PostContent({ post, content, className }: { post?: Post | null; content?: PostContentDoc | null; className?: string }) {
  const site = await getSite();
  const doc = content ?? post?.content;
  if (!content && post?.passwordProtected && !post.content) {
    const t = await getT();
    return <div className={cx(className ?? "entry-content", "ecx-content")}><PostPasswordForm postId={post.id} labels={{ intro: t("password.intro"), label: t("password.label"), submit: t("password.submit"), wrong: t("password.wrong") }} /></div>;
  }
  if (!doc?.blocks?.length) return null;
  const rendered = await renderContent(doc, await contentContext(site, post), (blocks) => applyFilters("post.blocks", blocks, { site, post }, site));
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
    ? <div className={cx(`ecx-region ecx-region-${name}`, "ecx-content", className)}>{await renderContent(doc, await contentContext(site, data?.post, data))}</div>
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
  const blocks = (await getActiveExtensions(site)).flatMap((d) => d.blockTypes ?? []);
  return {
    site, post, data, blocks,
    resolve: { shortcode: (name) => findShortcode(name, site), block: (type) => findBlock(type, site) },
    labels: { download: t("file.download"), toc: t("toc.title") },
    boundary: (name, key, el) => <ExtensionBoundary key={key} name={name}>{el}</ExtensionBoundary>,
    dynamic: renderDynamic,
    parts: async (slug) => (await getTemplates().catch(() => null))?.parts[slug] ?? null,
    region: (name, fallback) => regionOverride(name, fallback, site, data),
    pattern: (ref) => getPattern(ref),
  };
}
