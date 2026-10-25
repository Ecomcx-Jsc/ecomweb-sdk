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
      return (
        <div key={key} className={cx("ecx-navigation", `ecx-navigation-${a.orientation ?? "horizontal"}`, a.mobile !== false && "has-mobile")}>
          <div className="ecx-navigation-items">{menu}</div>
          {a.mobile !== false && <details className="ecx-navigation-toggle"><summary aria-label={t("navigation.menu")}>☰</summary>{menu}</details>}
        </div>
      );
    }
    case "search":
      return <div key={key} className="ecx-search"><SearchForm defaultValue={ctx.data?.search} placeholder={a.placeholder} buttonLabel={a.buttonText} /></div>;
    case "languageSwitcher":
      return <LanguageSwitcher key={key} className="ecx-language-switcher" />;
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
      return post ? <p key={key} className="ecx-post-date" style={align(a)}><PostDate post={post} site={site} /></p> : null;
    case "postAuthor":
      if (!post?.author) return null;
      return <p key={key} className="ecx-post-author">
        {a.avatar && post.author.avatarUrl && <img src={post.author.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: "50%", verticalAlign: "middle", marginRight: 8 }} />}
        <Link href={localeHref(site, `/author/${post.author.slug}`)} rel="author">{post.author.name}</Link>
      </p>;
    case "postTerms": {
      const terms = post?.terms?.[a.taxonomy ?? "category"];
      return terms?.length ? <p key={key} className="ecx-post-terms"><TermLinks terms={terms} separator={a.separator ?? ", "} /></p> : null;
    }
    case "comments":
      return post && ctx.data?.post?.id === post.id ? <Comments key={key} post={post} /> : null;

    case "query": {
      let posts: Post[]; let data: ResolveResult | undefined;
      if (a.inherit !== false && ctx.data?.posts) { posts = ctx.data.posts; data = ctx.data; }
      else {
        const taxonomy = a.category ? "category" : a.tag ? "post_tag" : undefined;
        const res = await getPosts({ type: a.postType ?? "post", perPage: a.perPage ?? 10, taxonomy, term: a.category || a.tag || undefined,
          orderBy: a.orderBy ?? "date", order: a.order ?? "desc" }).catch(() => null);
        posts = res?.items ?? [];
      }
      return <div key={key} className="ecx-query">{await children({ ...ctx, query: { posts, data } })}</div>;
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
      return ctx.query?.data ? <Pagination key={key} data={ctx.query.data} /> : null;
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
