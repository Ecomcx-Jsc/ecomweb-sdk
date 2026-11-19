import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getAdjacentPost, getArchives, getPosts, getTerms } from "./api";
import { Link, LoginOutLink, NavDrawer, NavToggle, QueryFilterBar, ScrollRow } from "./client";
import { buildPostQuery, SORTS } from "./query-filters";
import { Comments, FeaturedImage, LanguageSwitcher, Menu, Pagination, PostDate, SearchForm, TermLinks } from "./components";
import { getT } from "./i18n";
import { applyFilters } from "./runtime";
import { localeHref } from "./locale";
import { renderContent, type RenderContext, type RenderNode } from "./rich";
import type { Post, ResolveResult, Term } from "./types";
import { cx } from "./utils";
import { applyPatternOverrides, spacingValue } from "@ecomcx/ecomweb-content";

type Children = (ctx: RenderContext, nodes?: RenderNode[]) => Promise<ReactNode[]>;

const align = (a: Record<string, any>): CSSProperties | undefined => (a.textAlign && a.textAlign !== "left" ? { textAlign: a.textAlign } : undefined);
const ASPECT: Record<string, string> = { "16/9": "16 / 9", "4/3": "4 / 3", "1/1": "1 / 1", "3/4": "3 / 4" };

/**
 * Khối động (@ecomcx/ecomweb-content DYNAMIC_NODES): vẽ theo ngữ cảnh — website, trang đang xem (`ctx.data`), bài trong vòng lặp (`ctx.post`).
 * Ngoài template (nội dung bài) không có `ctx.data`: `postContent` không vẽ (tránh lặp vô hạn), `query` luôn tự lấy bài.
 */
export async function renderDynamic(node: RenderNode, key: string, ctx: RenderContext, children: Children): Promise<ReactNode> {
  const a = node.attrs ?? {};
  const site = ctx.site;
  const post: Post | null | undefined = ctx.post ?? ctx.data?.post;
  switch (node.type) {
    case "siteTitle": {
      const Tag = (a.level > 0 ? `h${Math.min(6, a.level)}` : "p") as "p";
      const title = a.link === false ? site.title : <Link href={localeHref(site, "/")} rel="home">{site.title}</Link>;
      return <Tag key={key} className="ecx-site-title" style={align(a)}>{title}</Tag>;
    }
    case "siteLogo": {
      const logo = site.themeSettings?.logo as { url?: string; width?: number; height?: number } | undefined;
      if (!logo?.url) return null;
      const img = <img src={logo.url} alt={site.title} width={a.width ?? 120} style={{ height: "auto" }} />;
      return <div key={key} className="ecx-site-logo">{a.link === false ? img : <Link href={localeHref(site, "/")} rel="home">{img}</Link>}</div>;
    }
    case "siteTagline":
      return site.tagline ? <p key={key} className="ecx-site-tagline" style={align(a)}>{site.tagline}</p> : null;
    case "navigation": {
      const location = String(a.location ?? "primary");
      const menu = <Menu location={location} className="ecx-navigation-menu" />;
      const t = await getT();
      // overlayMenu never | mobile (≤640px) | tablet (≤1024px) | always; thiếu thì theo `mobile` cũ
      const overlay = ["never", "mobile", "tablet", "always"].includes(a.overlayMenu) ? a.overlayMenu : a.mobile === false ? "never" : "mobile";
      return (
        <div key={key} className={cx("ecx-navigation", `ecx-navigation-${a.orientation ?? "horizontal"}`, overlay !== "never" && "has-mobile", overlay === "tablet" && "bp-tablet", overlay === "always" && "overlay-always")}>
          {overlay !== "always" && <div className="ecx-navigation-items">{menu}</div>}
          {overlay !== "never" && <NavDrawer label={t("navigation.menu")} closeLabel={t("navigation.close")}>{menu}</NavDrawer>}
        </div>
      );
    }
    case "search":
      return <div key={key} className="ecx-search"><SearchForm defaultValue={ctx.data?.search} placeholder={a.placeholder} buttonLabel={a.buttonText}
        postType={typeof a.postType === "string" && /^[a-z0-9_-]{1,64}$/i.test(a.postType) ? a.postType : undefined} showLabel={a.showLabel === true}
        buttonPosition={a.buttonPosition === "left" || a.buttonPosition === "below" ? a.buttonPosition : "right"} buttonIcon={a.buttonStyle === "icon"}
        scopes={a.scopeSelect === true ? parseScopes(a.scopes) : undefined} scopeType={ctx.data?.query?.type} collapse={a.collapse === "tablet" || a.collapse === "mobile" ? a.collapse : undefined} /></div>;
    case "languageSwitcher":
      return <LanguageSwitcher key={key} className="ecx-language-switcher" variant={a.display === "dropdown" ? "select" : "list"} />;
    case "copyright":
      return <p key={key} className="ecx-copyright" style={align(a)}>© {new Date().getFullYear()} {a.text || site.title}</p>;

    case "postTitle": {
      if (!post) return null;
      const Tag = `h${Math.min(6, Math.max(1, a.level ?? 1))}` as "h1";
      return <Tag key={key} className="ecx-post-title" style={align(a)}>{a.link ? <Link href={post.link}>{post.title}</Link> : post.title}</Tag>;
    }
    case "postContent": {
      if (!post || !ctx.data) return null;
      const { PostContent } = await import("./content");
      return <PostContent key={key} post={post} page={Number(ctx.data.query?.trang)} />;
    }
    case "postExcerpt":
      if (!post?.excerpt) return null;
      return <p key={key} className="ecx-post-excerpt">{post.excerpt}{a.moreText && <> <Link href={post.link} className="ecx-more-link">{a.moreText}</Link></>}</p>;
    case "featuredImage": {
      if (!post?.featuredMedia) return null;
      const ratio = ASPECT[a.aspect as string];
      return <div key={key} className="ecx-featured-image" style={ratio ? ({ "--ecx-ar": ratio, overflow: "hidden" } as CSSProperties) : undefined}>
        <FeaturedImage media={post.featuredMedia} size={a.size ?? "large"} link={a.link ? post.link : undefined} label={post.title} />
      </div>;
    }
    case "postDate":
      return post ? <p key={key} className="ecx-post-date" style={align(a)}><PostDate post={a.displayType === "modified" ? { ...post, publishedAt: post.updatedAt } : post} site={site} /></p> : null;
    case "postAuthor":
      if (!post?.author) return null;
      {
        const size = Math.min(128, Math.max(16, Number(a.avatarSize) || 32));
        const name = a.showName === false ? null : a.link === false ? <span>{post.author.name}</span> : <Link href={localeHref(site, `/author/${post.author.slug}`)} rel="author">{post.author.name}</Link>;
        return <p key={key} className="ecx-post-author">
          {a.avatar && post.author.avatarUrl && <img src={post.author.avatarUrl} alt={a.showName === false ? post.author.name : ""} width={size} height={size} style={{ borderRadius: "50%", verticalAlign: "middle", marginRight: name ? 8 : 0 }} />}
          {name}
          {a.showBio === true && post.author.bio && <span className="ecx-post-author-bio"> {post.author.bio}</span>}
        </p>;
      }
    case "readMore":
      return post ? <p key={key} className="ecx-read-more" style={align(a)}><Link href={post.link}>{a.text || (await getT())("post.read_more")}</Link></p> : null;
    case "commentsCount":
      return post ? <p key={key} className="ecx-comments-count" style={align(a)}>{post.commentCount}</p> : null;
    case "avatar": {
      const size = Math.min(256, Math.max(16, Number(a.size) || 48));
      const au = post?.author;
      if (!au?.avatarUrl) return null;
      const img = <img src={au.avatarUrl} alt={au.name} width={size} height={size} loading="lazy" style={{ borderRadius: "50%" }} />;
      return <span key={key} className="ecx-avatar">{a.link === false ? img : <Link href={localeHref(site, `/author/${au.slug}`)} rel="author">{img}</Link>}</span>;
    }
    case "queryTotal":
      return ctx.query?.data ? <p key={key} className="ecx-query-total" style={align(a)}>{ctx.query.data.total}</p> : null;
    case "loginout": {
      const t = await getT();
      return <p key={key} className="ecx-loginout" style={align(a)}><LoginOutLink loginHref={localeHref(site, "/login")} loginText={a.loginText || t("auth.submitLogin")} logoutText={a.logoutText || t("auth.logout")} /></p>;
    }
    case "termList": {
      const taxonomy = String(a.taxonomy ?? "category");
      if (!/^[a-z0-9_-]{1,64}$/i.test(taxonomy)) return null;
      const terms = await getTerms({ taxonomy, hideEmpty: a.hideEmpty !== false }).catch(() => [] as Term[]);
      if (!terms.length) return null;
      const label = (t: Term) => <><Link href={t.link} rel="tag">{t.name}</Link>{a.showCount === true && <> ({t.count})</>}</>;
      if (a.display === "cloud") {
        const max = Math.max(...terms.map((t) => t.count), 1);
        return <p key={key} className="ecx-term-list is-cloud">{terms.map((t) => <span key={t.id} style={{ fontSize: `${(0.8 + (t.count / max) * 0.9).toFixed(2)}em`, marginRight: "0.5em" }}>{label(t)}</span>)}</p>;
      }
      if (a.hierarchical === true) {
        const ids = new Set(terms.map((t) => t.id));
        const tree = (parent: number | null, depth: number): ReactNode => {
          const rows = terms.filter((t) => (parent === null ? !t.parentId || !ids.has(t.parentId) : t.parentId === parent));
          return rows.length && depth < 5 ? <ul>{rows.map((t) => <li key={t.id}>{label(t)}{tree(t.id, depth + 1)}</li>)}</ul> : null;
        };
        return <nav key={key} className="ecx-term-list">{tree(null, 0)}</nav>;
      }
      return <ul key={key} className="ecx-term-list">{terms.map((t) => <li key={t.id}>{label(t)}</li>)}</ul>;
    }
    case "pageList": {
      const pages = (await getPosts({ type: "page", perPage: 50, orderBy: "menu_order", order: "asc" }).catch(() => null))?.items ?? [];
      const rootId = typeof a.parentId === "number" ? a.parentId : null;
      const maxDepth = Math.min(3, Math.max(1, Number(a.depth) || 2));
      const ids = new Set(pages.map((p) => p.id));
      const tree = (parent: number | null, depth: number): ReactNode => {
        const rows = pages.filter((p) => (parent === null ? !p.parentId || !ids.has(p.parentId) : p.parentId === parent));
        return rows.length && depth < maxDepth ? <ul>{rows.map((p) => <li key={p.id}><Link href={p.link}>{p.title}</Link>{tree(p.id, depth + 1)}</li>)}</ul> : null;
      };
      const list = tree(rootId, 0);
      return list ? <nav key={key} className="ecx-page-list">{list}</nav> : null;
    }
    case "archives": {
      const [rows, t] = await Promise.all([getArchives().catch(() => []), getT()]);
      if (!rows.length) return null;
      return <ul key={key} className="ecx-archives">{rows.slice(0, Math.min(60, Math.max(1, Number(a.limit) || 12))).map((r) => <li key={r.link}><Link href={r.link}>{t("archives.month", { month: r.month, year: r.year })}</Link>{a.showCount !== false && <> ({r.count})</>}</li>)}</ul>;
    }
    case "postTerms": {
      const terms = post?.terms?.[a.taxonomy ?? "category"];
      return terms?.length ? <p key={key} className="ecx-post-terms"><TermLinks terms={terms} separator={a.separator ?? ", "} /></p> : null;
    }
    case "comments":
      return post && ctx.data?.post?.id === post.id ? <Comments key={key} post={post} title={a.title ? String(a.title) : undefined} perPage={typeof a.perPage === "number" ? a.perPage : undefined} order={a.order === "asc" || a.order === "desc" ? a.order : undefined} avatarSize={typeof a.avatarSize === "number" ? a.avatarSize : undefined} showDate={a.showDate === false ? false : undefined} /> : null;

    // H1 của trang lưu trữ / tìm kiếm / tác giả (trang chủ dạng danh sách bài: tên trang)
    case "queryTitle": {
      const d = ctx.data;
      if (!d) return null;
      const t = await getT();
      const Tag = `h${Math.min(6, Math.max(1, a.level ?? 1))}` as "h1";
      const text = d.search != null ? t("query.search", { q: d.search })
        : d.term ? (a.prefix ? t(d.term.taxonomy === "post_tag" ? "query.tag" : "query.category", { name: d.term.name }) : d.term.name)
        : d.author ? (a.prefix ? t("query.author", { name: d.author.name }) : d.author.name)
        : d.title || site.title;
      return <Tag key={key} className="ecx-query-title" style={align(a)}>{text}</Tag>;
    }
    case "termDescription":
      return ctx.data?.term?.description ? <div key={key} className="ecx-term-description" style={align(a)}>{ctx.data.term.description}</div> : null;
    case "breadcrumbs": {
      const d = ctx.data;
      if (!d) return null;
      const t = await getT();
      const items: Array<{ name: string; href?: string }> = [];
      if (a.showHome !== false) items.push({ name: t("breadcrumbs.home"), href: localeHref(site, "/") });
      const cat = d.post?.terms?.category?.[0];
      if (d.post && cat) items.push({ name: cat.name, href: cat.link });
      const current = d.post?.title ?? d.term?.name ?? d.author?.name ?? (d.search != null ? t("query.search", { q: d.search }) : d.title);
      if (a.showCurrent !== false && current) items.push({ name: current });
      if (items.length < 2) return null;
      const base = (site.url ?? "").replace(/\/$/, "");
      // Schema BreadcrumbList: Google hiện đường dẫn thay cho URL trong kết quả tìm kiếm
      // Plugin SEO có schema riêng (BreadcrumbList trong @graph) trả null để trang không có hai BreadcrumbList mâu thuẫn
      const jsonLd = await applyFilters("breadcrumbs.schema", { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, ...(it.href ? { item: /^https?:/.test(it.href) ? it.href : base + it.href } : {}) })) }, { site, items }, site);
      return (
        <nav key={key} className="ecx-breadcrumbs" aria-label={t("breadcrumbs.label")}>
          <ol>{items.map((it, i) => <li key={i}>{i > 0 && <span className="ecx-breadcrumbs-sep" aria-hidden="true">{a.separator ?? "›"}</span>}{it.href ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}</li>)}</ol>
          {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        </nav>
      );
    }
    case "postNavigation": {
      const cur = ctx.data?.post;
      if (!cur || !cur.publishedAt) return null;
      const t = await getT();
      const [prev, next] = await Promise.all([
        getAdjacentPost(cur, "prev").catch(() => null),
        getAdjacentPost(cur, "next").catch(() => null),
      ]);
      if (!prev && !next) return null;
      return (
        <nav key={key} className="ecx-post-navigation" aria-label={t("postNav.label")}>
          {prev ? <Link className="ecx-post-navigation-prev" href={prev.link} rel="prev"><span>{t("postNav.previous")}</span>{a.showTitle !== false && <strong>{prev.title}</strong>}</Link> : <span />}
          {next ? <Link className="ecx-post-navigation-next" href={next.link} rel="next"><span>{t("postNav.next")}</span>{a.showTitle !== false && <strong>{next.title}</strong>}</Link> : <span />}
        </nav>
      );
    }

    case "query": {
      let posts: Post[]; let data: ResolveResult | undefined; let pageParam: string | undefined;
      const hasUrlFilter = a.urlFilters === true && Object.keys(ctx.data?.query ?? {}).some((k) => k.startsWith("fq_"));
      if (a.inherit !== false && ctx.data?.posts && !hasUrlFilter) { posts = ctx.data.posts; data = ctx.data; }
      else {
        const fromContext = a.inherit !== false && !!ctx.data;
        // paginate: khối nằm trong một trang → phân trang bằng ?qpage=N (không đụng /page/N của chính trang); trang lưu trữ lọc theo URL giữ /page/N
        const paginate = a.paginate === true && !!ctx.data && !fromContext;
        const page = fromContext ? Math.max(1, ctx.data?.page ?? 1) : paginate ? Math.max(1, Math.floor(Number(ctx.data?.query?.qpage)) || 1) : 1;
        const res = await getPosts({ ...buildPostQuery(a, { post: ctx.post ?? ctx.data?.post, data: ctx.data, fromContext }), page }).catch(() => null);
        posts = res?.items ?? [];
        if ((paginate || fromContext) && res && ctx.data) { data = { ...ctx.data, page: res.page, totalPages: res.totalPages, total: res.total }; pageParam = fromContext ? undefined : "qpage"; }
      }
      return <div key={key} className="ecx-query">{await children({ ...ctx, query: { posts, data, pageParam } })}</div>;
    }
    case "queryFilter": {
      const taxonomy = /^[a-z0-9_-]{1,64}$/i.test(String(a.taxonomy ?? "")) ? String(a.taxonomy) : undefined;
      const style = ["none", "links", "chips", "select", "checks"].includes(a.termStyle) ? a.termStyle : "links";
      const [t, terms] = await Promise.all([getT(), taxonomy && style !== "none" ? getTerms({ taxonomy, hideEmpty: true }).catch(() => []) : Promise.resolve([])]);
      const sorts = String(a.sortOptions ?? "date_desc,date_asc,title_asc,title_desc").split(",").map((x) => x.trim()).filter((x) => SORTS[x]);
      return <QueryFilterBar key={key} action={String(a.action || ctx.data?.basePath || "/")} taxonomy={taxonomy} termStyle={style} terms={terms.map((x) => ({ slug: x.slug, name: x.name, link: x.link }))}
        currentTerm={ctx.data?.term?.slug} values={ctx.data?.query ?? {}} showSearch={a.showSearch === true} showSort={a.showSort === true} range={a.showRange === true && /^[a-z][a-z0-9_]{0,30}$/.test(String(a.rangeParam ?? "")) ? { param: String(a.rangeParam), label: a.rangeLabel ? String(a.rangeLabel) : undefined, max: Number(a.rangeMax) > 0 ? Number(a.rangeMax) : undefined } : undefined} showYear={a.showYear === true} showReset={a.showReset === true} years={a.showYear === true ? Array.from({ length: 8 }, (_, i) => new Date().getUTCFullYear() - i) : []} sorts={sorts.map((x) => ({ value: x, label: t(`filter.sort.${x}`) }))}
        labels={{ all: String(a.allLabel || t("filter.all")), search: t("search.label"), placeholder: String(a.placeholder || t("filter.search")), submit: String(a.submitText || t("filter.apply")), sort: t("filter.sort"), year: t("filter.year"), reset: t("filter.reset"), from: t("filter.from"), to: t("filter.to") }} />;
    }
    case "postTemplate": {
      const posts = ctx.query?.posts ?? [];
      if (!posts.length) return null;
      const grid = a.layout === "grid";
      const carousel = a.layout === "carousel";
      const per = Math.min(6, Math.max(1, Math.round(Number(a.columns)) || 3));
      const gap = spacingValue(a.gap) ?? "1.5rem";
      // Đúng N cột khi đủ chỗ (như canvas), ít cột hơn khi hẹp (mỗi cột tối thiểu 12rem) — trước đây N chỉ là gợi ý nên 3 cột thành 2
      // Đặt số cột riêng cho tablet / điện thoại → lưới theo biến CSS (is-responsive); không thì như cũ: tự giảm cột khi hẹp (mỗi cột tối thiểu 12rem)
      const tablet = Math.round(Number(a.columnsTablet)) || 0, mobile = Math.round(Number(a.columnsMobile)) || 0;
      const responsive = grid && (tablet > 0 || mobile > 0);
      const style: CSSProperties | undefined = responsive ? { "--per": per, "--per-tablet": tablet || Math.min(per, 3), "--per-mobile": mobile || Math.min(per, 2), "--gap": gap } as CSSProperties
        : grid ? { display: "grid", gap, gridTemplateColumns: `repeat(auto-fill, minmax(max(12rem, calc((100% - ${per - 1} * ${gap}) / ${per})), 1fr))`, listStyle: "none", padding: 0 }
        : carousel ? { "--per": per, "--per-tablet": Math.min(per, 3), "--per-mobile": Math.min(per, 2), "--gap": gap } as CSSProperties
        : { listStyle: "none", padding: 0 };
      const items = await Promise.all(posts.map(async (p) => <li key={p.id} className="ecx-post">{await children({ ...ctx, post: p })}</li>));
      const list = <ul key={key} className={cx("ecx-post-template", grid && "is-grid", responsive && "is-responsive", carousel && "is-carousel")} style={style}>{items}</ul>;
      return carousel ? <ScrollRow key={key} arrows={a.arrows !== false}>{list}</ScrollRow> : list;
    }
    case "pagination":
      return ctx.query?.data ? <Pagination key={key} data={ctx.query.data} pageParam={ctx.query.pageParam} type={["numbers", "prevNext", "both"].includes(a.type) ? a.type : "both"} midSize={Math.min(5, Math.max(0, Number.isFinite(Number(a.midSize)) ? Number(a.midSize) : 2))} /> : null;
    case "queryEmpty":
      return ctx.query && !ctx.query.posts.length ? <div key={key} className="ecx-query-empty">{await children(ctx)}</div> : null;
    case "syncedPattern": {
      if (typeof a.ref !== "number" || !ctx.pattern || (ctx.partDepth ?? 0) >= 4) return null;
      const base = await ctx.pattern(a.ref);
      if (!base) return null;
      const doc = applyPatternOverrides(base, a.overrides); // 1.32: chỗ dùng mẫu sửa riêng vài ô (khối có overrideKey trong mẫu)
      return <Fragment key={key}>{await renderContent(doc, { ...ctx, partDepth: (ctx.partDepth ?? 0) + 1, source: `pattern:${a.ref}` })}</Fragment>;
    }
    case "templatePart": {
      if (!a.slug || !ctx.parts || (ctx.partDepth ?? 0) >= 4) return null;
      const doc = await ctx.parts(String(a.slug));
      const Tag = (["header", "footer", "aside", "section"].includes(a.tagName) ? a.tagName : "div") as "div";
      const part = doc ? <Tag className={cx("ecx-template-part", `ecx-template-part-${a.slug}`)}>{await renderContent(doc, { ...ctx, partDepth: (ctx.partDepth ?? 0) + 1, source: `part:${a.slug}` })}</Tag> : null;
      const el = ctx.region ? await ctx.region(String(a.slug), part) : part;
      return el == null ? null : <Fragment key={key}>{el}</Fragment>;
    }
  }
  return null;
}

/** "product:Sản phẩm, post:Tin tức" → tuỳ chọn của ô chọn phạm vi tìm kiếm (loại không hợp lệ bị bỏ; không ghi nhãn thì lấy chính tên loại). */
function parseScopes(v: unknown): Array<{ value: string; label: string }> {
  if (typeof v !== "string") return [];
  return v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10).flatMap((x) => {
    const [value, ...rest] = x.split(":");
    return /^[a-z0-9_-]{1,64}$/i.test(value.trim()) ? [{ value: value.trim(), label: rest.join(":").trim() || value.trim() }] : [];
  });
}
