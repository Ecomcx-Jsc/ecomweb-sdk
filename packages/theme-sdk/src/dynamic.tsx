import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getPosts } from "./api";
import { Link } from "./client";
import { Comments, FeaturedImage, LanguageSwitcher, Menu, Pagination, PostDate, SearchForm, TermLinks } from "./components";
import { getT } from "./i18n";
import { localeHref } from "./locale";
import { renderContent, type RenderContext, type RenderNode } from "./rich";
import type { Post, ResolveResult } from "./types";
import { cx } from "./utils";

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
      // next: overlayMenu never|mobile|always; thiếu thì theo `mobile` cũ
      const overlay = ["never", "mobile", "always"].includes(a.overlayMenu) ? a.overlayMenu : a.mobile === false ? "never" : "mobile";
      return (
        <div key={key} className={cx("ecx-navigation", `ecx-navigation-${a.orientation ?? "horizontal"}`, overlay !== "never" && "has-mobile", overlay === "always" && "overlay-always")}>
          {overlay !== "always" && <div className="ecx-navigation-items">{menu}</div>}
          {overlay !== "never" && <details className="ecx-navigation-toggle"><summary aria-label={t("navigation.menu")}>☰</summary>{menu}</details>}
        </div>
      );
    }
    case "search":
      return <div key={key} className="ecx-search"><SearchForm defaultValue={ctx.data?.search} placeholder={a.placeholder} buttonLabel={a.buttonText} /></div>;
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
      return <PostContent key={key} post={post} />;
    }
    case "postExcerpt":
      if (!post?.excerpt) return null;
      return <p key={key} className="ecx-post-excerpt">{post.excerpt}{a.moreText && <> <Link href={post.link} className="ecx-more-link">{a.moreText}</Link></>}</p>;
    case "featuredImage": {
      if (!post?.featuredMedia) return null;
      const ratio = ASPECT[a.aspect as string];
      return <div key={key} className="ecx-featured-image" style={ratio ? { aspectRatio: ratio, overflow: "hidden" } : undefined}>
        <FeaturedImage media={post.featuredMedia} size={a.size ?? "large"} link={a.link ? post.link : undefined} />
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
    case "postTerms": {
      const terms = post?.terms?.[a.taxonomy ?? "category"];
      return terms?.length ? <p key={key} className="ecx-post-terms"><TermLinks terms={terms} separator={a.separator ?? ", "} /></p> : null;
    }
    case "comments":
      return post && ctx.data?.post?.id === post.id ? <Comments key={key} post={post} title={a.title ? String(a.title) : undefined} /> : null;

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
      const jsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, ...(it.href ? { item: /^https?:/.test(it.href) ? it.href : base + it.href } : {}) })) };
      return (
        <nav key={key} className="ecx-breadcrumbs" aria-label={t("breadcrumbs.label")}>
          <ol>{items.map((it, i) => <li key={i}>{i > 0 && <span className="ecx-breadcrumbs-sep" aria-hidden="true">{a.separator ?? "›"}</span>}{it.href ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}</li>)}</ol>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        </nav>
      );
    }
    case "postNavigation": {
      const cur = ctx.data?.post;
      if (!cur || !cur.publishedAt) return null;
      const t = await getT();
      const [prev, next] = await Promise.all([
        getPosts({ type: cur.type, perPage: 1, before: cur.publishedAt, orderBy: "date", order: "desc", exclude: [cur.id] }).then((r) => r.items[0]).catch(() => undefined),
        getPosts({ type: cur.type, perPage: 1, after: cur.publishedAt, orderBy: "date", order: "asc", exclude: [cur.id] }).then((r) => r.items[0]).catch(() => undefined),
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
      if (a.inherit !== false && ctx.data?.posts) { posts = ctx.data.posts; data = ctx.data; }
      else {
        const taxonomy = a.category ? "category" : a.tag ? "post_tag" : undefined;
        const exclude = String(a.exclude ?? "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
        // paginate: khối nằm trong một trang → phân trang bằng ?qpage=N (không đụng /page/N của chính trang)
        const paginate = a.paginate === true && !!ctx.data;
        const page = paginate ? Math.max(1, Math.floor(Number(ctx.data?.query?.qpage)) || 1) : 1;
        const res = await getPosts({ page, type: a.postType ?? "post", perPage: a.perPage ?? 10, taxonomy, term: a.category || a.tag || undefined,
          orderBy: a.orderBy ?? "date", order: a.order ?? "desc",
          authorId: typeof a.authorId === "number" ? a.authorId : undefined, search: a.search || undefined, exclude: exclude.length ? exclude : undefined,
          sticky: a.sticky === "only" ? true : a.sticky === "exclude" ? false : undefined, orderByMeta: a.orderByMeta || undefined }).catch(() => null);
        posts = res?.items ?? [];
        if (paginate && res && ctx.data) { data = { ...ctx.data, page: res.page, totalPages: res.totalPages, total: res.total }; pageParam = "qpage"; }
      }
      return <div key={key} className="ecx-query">{await children({ ...ctx, query: { posts, data, pageParam } })}</div>;
    }
    case "postTemplate": {
      const posts = ctx.query?.posts ?? [];
      if (!posts.length) return null;
      const grid = a.layout === "grid";
      const style: CSSProperties | undefined = grid ? { display: "grid", gap: "1.5rem", gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${Math.floor(60 / (a.columns ?? 3))}rem), 1fr))`, listStyle: "none", padding: 0 } : { listStyle: "none", padding: 0 };
      const items = await Promise.all(posts.map(async (p) => <li key={p.id} className="ecx-post">{await children({ ...ctx, post: p })}</li>));
      return <ul key={key} className={cx("ecx-post-template", grid && "is-grid")} style={style}>{items}</ul>;
    }
    case "pagination":
      return ctx.query?.data ? <Pagination key={key} data={ctx.query.data} pageParam={ctx.query.pageParam} type={["numbers", "prevNext", "both"].includes(a.type) ? a.type : "both"} midSize={Math.min(5, Math.max(0, Number.isFinite(Number(a.midSize)) ? Number(a.midSize) : 2))} /> : null;
    case "queryEmpty":
      return ctx.query && !ctx.query.posts.length ? <div key={key} className="ecx-query-empty">{await children(ctx)}</div> : null;
    case "syncedPattern": {
      if (typeof a.ref !== "number" || !ctx.pattern || (ctx.partDepth ?? 0) >= 4) return null;
      const doc = await ctx.pattern(a.ref);
      if (!doc) return null;
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
