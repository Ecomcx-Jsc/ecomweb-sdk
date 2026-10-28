import type { ReactNode } from "react";
import { getArchives, getComments, getMenu, getMenuById, getPosts, getSite, getTerms, getWidgets } from "./api";
import { findWidget, getSlotComponents, getSlotItems } from "./runtime";
import type { Media, MenuItem, Post, ResolveResult, SlotName, WidgetInstance } from "./types";
import { cx, formatDate, pageLink, pageLinkWithQuery } from "./utils";
import { Img } from "./image";
import { CommentForm, CommentList, CommentsMore, ExtensionBoundary, LanguageSwitcherClient, Link, SearchFormClient } from "./client";
import { getT } from "./i18n";
import { localeHref } from "./locale";

// ---------------------------------------------------------------------------
// Menu theo vị trí
// ---------------------------------------------------------------------------

function MenuItems({ items, currentPath, depth }: { items: MenuItem[]; currentPath?: string; depth: number }) {
  return (
    <ul className={depth === 0 ? "menu" : "sub-menu"}>
      {items.map((item) => {
        const active = currentPath !== undefined && (item.url === currentPath || (item.url !== "/" && currentPath.startsWith(item.url + "/")));
        return (
          <li key={item.id} className={cx("menu-item", item.cssClass, active && "current-menu-item", item.children.length > 0 && "has-children")}>
            <Link href={item.url} target={item.target ?? undefined} rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
              aria-current={active ? "page" : undefined} activeClassName="current-menu-link" matchNested={item.url !== "/"}>
              {item.title}
            </Link>
            {item.children.length > 0 && <MenuItems items={item.children} currentPath={currentPath} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

export async function Menu({ location, menuId, currentPath, className, fallback }: {
  location?: string; menuId?: number; currentPath?: string; className?: string; fallback?: ReactNode;
}) {
  const menu = menuId ? await getMenuById(menuId) : location ? await getMenu(location) : null;
  if (!menu || menu.items.length === 0) return <>{fallback ?? null}</>;
  return <nav className={className} aria-label={menu.name}><MenuItems items={menu.items} currentPath={currentPath} depth={0} /></nav>;
}

// ---------------------------------------------------------------------------
// Khu vực widget
// ---------------------------------------------------------------------------

async function CoreWidget({ widget }: { widget: WidgetInstance }) {
  const s = widget.settings ?? {};
  switch (widget.type) {
    case "text": return <div className="textwidget">{String(s.text ?? "").split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>;
    case "html": return <div className="textwidget" dangerouslySetInnerHTML={{ __html: String(s.html ?? "") }} />;
    case "search": return <SearchForm />;
    case "recent-posts": {
      const { items } = await getPosts({ perPage: Number(s.number) || 5 });
      return <ul>{items.map((p) => <li key={p.id}><Link href={p.link}>{p.title}</Link></li>)}</ul>;
    }
    case "categories": {
      const terms = await getTerms("category", true);
      // Phân cấp: chuyên mục con lồng trong chuyên mục cha
      const ids = new Set(terms.map((t) => t.id));
      const tree = (parent: number | null): ReactNode => {
        const level = terms.filter((t) => (t.parentId && ids.has(t.parentId) ? t.parentId : null) === parent);
        return level.length ? <ul className={parent ? "children" : undefined}>{level.map((t) => <li key={t.id} className="cat-item"><Link href={t.link}>{t.name}</Link>{s.showCount ? ` (${t.count})` : ""}{tree(t.id)}</li>)}</ul> : null;
      };
      return tree(null);
    }
    case "tag-cloud": {
      const terms = await getTerms("post_tag", true);
      const max = Math.max(1, ...terms.map((t) => t.count));
      return <div className="tagcloud">{terms.map((t) => <Link key={t.id} href={t.link} style={{ fontSize: `${0.8 + (t.count / max) * 0.8}em` }}>{t.name}</Link>)}</div>;
    }
    case "archives": {
      const [rows, t] = await Promise.all([getArchives(), getT()]);
      return <ul>{rows.map((r) => <li key={r.link}><Link href={r.link}>{t("archives.month", { month: r.month, year: r.year })}</Link> ({r.count})</li>)}</ul>;
    }
    case "menu": return s.menuId ? <Menu menuId={Number(s.menuId)} /> : null;
    default: return null;
  }
}

export async function WidgetArea({ id, className }: { id: string; className?: string }) {
  const [site, widgets] = await Promise.all([getSite(), getWidgets(id)]);
  if (widgets.length === 0) return null;
  const rendered = await Promise.all(widgets.map(async (w) => {
    const Plugin = await findWidget(w.type, site);
    const body = Plugin ? <ExtensionBoundary name={`Widget ${w.type}`}><Plugin widget={w} settings={w.settings ?? {}} site={site} /></ExtensionBoundary> : await CoreWidget({ widget: w });
    if (!body) return null;
    return (
      <section key={w.id} className={cx("widget", `widget-${w.type}`)}>
        {w.title && <h2 className="widget-title">{w.title}</h2>}
        {body}
      </section>
    );
  }));
  return <aside className={cx("widget-area", className)} data-area={id}>{rendered}</aside>;
}

// ---------------------------------------------------------------------------
// Slot cho plugin (head, cuối trang, trước/sau nội dung…)
// ---------------------------------------------------------------------------

export async function Slot<P = any>({
  name,
  data,
  props,
  fallback,
  className,
}: {
  name: SlotName;
  data?: ResolveResult | null;
  props?: P;
  fallback?: ReactNode;
  className?: string;
}) {
  const site = await getSite();
  const items = await getSlotItems(name, site);
  if (items.length === 0) return <>{fallback ?? null}</>;

  const elements = items.map(({ Component, priority }, i) => (
    <ExtensionBoundary key={`${i}-${priority}`} name={`Slot ${name}`}>
      <Component site={site} data={data} {...(props as any)} />
    </ExtensionBoundary>
  ));

  return className ? <div className={className}>{elements}</div> : <>{elements}</>;
}

// ---------------------------------------------------------------------------
// Tiện ích hiển thị
// ---------------------------------------------------------------------------

/** Ô tìm kiếm — gửi về trang chủ của ngôn ngữ hiện tại (/?s= hoặc /en?s=). */
export async function SearchForm({ defaultValue, placeholder, buttonLabel }: { defaultValue?: string | null; placeholder?: string; buttonLabel?: string }) {
  const [t, site] = await Promise.all([getT(), getSite()]);
  return <SearchFormClient action={localeHref(site, "/")} defaultValue={defaultValue} placeholder={placeholder ?? t("search.placeholder")} label={t("search.label")} buttonLabel={buttonLabel ?? t("search.button")} />;
}

export async function Pagination({ data, prevLabel, nextLabel }: { data: ResolveResult; prevLabel?: string; nextLabel?: string }) {
  if (data.totalPages <= 1) return null;
  const t = await getT();
  prevLabel ??= t("pagination.prev");
  nextLabel ??= t("pagination.next");
  const pages: Array<number | "…"> = [];
  for (let i = 1; i <= data.totalPages; i++) {
    if (i === 1 || i === data.totalPages || Math.abs(i - data.page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  // Danh sách có bộ lọc (?phong-ban=…, ?muc-luong=…) → giữ nguyên bộ lọc khi chuyển trang
  const hasFilters = Object.keys(data.query ?? {}).some((k) => k !== "s" && k !== "page");
  const link = (p: number) => hasFilters
    ? pageLinkWithQuery(data.basePath, p, data.query)
    : pageLink(data.basePath, p, data.kind === "search" ? data.search : null);
  return (
    <nav className="pagination" aria-label={t("pagination.label")}>
      {data.page > 1 && <Link className="prev" href={link(data.page - 1)}>{prevLabel}</Link>}
      {pages.map((p, i) => p === "…" ? <span key={`e${i}`} className="dots">…</span>
        : p === data.page ? <span key={p} className="current" aria-current="page">{p}</span>
        : <Link key={p} href={link(p)}>{p}</Link>)}
      {data.page < data.totalPages && <Link className="next" href={link(data.page + 1)}>{nextLabel}</Link>}
    </nav>
  );
}

/** Ảnh đại diện: responsive, WebP, srcset. */
export function FeaturedImage({ media, size = "large", className, link, sizes, priority }: { media?: Media | null; size?: string; className?: string; link?: string; sizes?: string; priority?: boolean }) {
  if (!media) return null;
  const img = <Img media={media} size={size} sizes={sizes} priority={priority} />;
  return <figure className={cx("featured-image", className)}>{link ? <Link href={link}>{img}</Link> : img}</figure>;
}

export function PostDate({ post, site }: { post: Post; site?: { dateFormat: string; timezone: string; locale?: string } }) {
  return <time dateTime={post.publishedAt ?? post.createdAt}>{formatDate(post.publishedAt ?? post.createdAt, site)}</time>;
}

export function TermLinks({ terms, separator = ", " }: { terms?: Array<{ id: number; name: string; link: string }>; separator?: string }) {
  if (!terms?.length) return null;
  return <>{terms.map((t, i) => <span key={t.id}>{i > 0 && separator}<Link href={t.link} rel="tag">{t.name}</Link></span>)}</>;
}

// ---------------------------------------------------------------------------
// Khu bình luận
// ---------------------------------------------------------------------------

export async function Comments({ post, title }: { post: Post; title?: string }) {
  if (post.commentStatus !== "open" && post.commentCount === 0) return null;
  if (post.passwordProtected && !post.content) return null; // bài có mật khẩu: ẩn bình luận tới khi mở khoá
  const [site, page, t] = await Promise.all([getSite(), getComments(post.id), getT()]);
  const comments = page?.items ?? [];
  const dateSite = { dateFormat: site.dateFormat, timezone: site.timezone, locale: site.locale };
  title ??= t("comments.title");
  const labels = Object.fromEntries(["title", "content", "name", "email", "website", "submit", "sending", "approved", "pending", "error"].map((k) => [k, t(`comments.form.${k}`)]));
  return (
    <section id="comments" className="comments-area">
      <Slot name="comments.before" props={{ post }} />
      <h2 className="comments-title">{title} ({post.commentCount})</h2>
      {comments.length > 0 && <CommentList comments={comments} site={dateSite} />}
      {(page?.totalPages ?? 1) > 1 && <CommentsMore postId={post.id} totalPages={page.totalPages} site={dateSite} labels={{ more: t("comments.more"), loading: t("comments.loading"), error: t("comments.form.error") }} />}
      {post.commentStatus === "open"
        ? <CommentForm postId={post.id} labels={labels} fields={<Slot name="comment_form.fields" props={{ post }} />} />
        : <p className="no-comments">{t("comments.closed")}</p>}
      <Slot name="comments.after" props={{ post }} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chuyển ngôn ngữ
// ---------------------------------------------------------------------------

/**
 * Nút chuyển ngôn ngữ. Đặt ở layout của theme. Ẩn khi site chỉ có một ngôn ngữ.
 * Liên kết tới đúng bản dịch của trang hiện tại (đọc thẻ hreflang), không có thì về trang chủ ngôn ngữ đó.
 */
export async function LanguageSwitcher({ className, variant = "list" }: { className?: string; variant?: "list" | "select" }) {
  const [site, t] = await Promise.all([getSite(), getT()]);
  if (site.languages.length < 2) return null;
  return <LanguageSwitcherClient className={className} variant={variant} current={site.locale} defaultLocale={site.defaultLocale} label={t("language.label")}
    languages={site.languages.map((l) => ({ code: l.code, name: l.name, flag: l.flag ?? undefined }))} />;
}
