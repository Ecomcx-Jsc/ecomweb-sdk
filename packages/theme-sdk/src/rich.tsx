import { Fragment, cloneElement, isValidElement, type ComponentType, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { DYNAMIC_NODES, colorCss, embedInfo, normalizeContent, safeUrl, spacingValue, styleClass, styleCss, type BlockStyle, type Block, type BlockDefinition, type ContentDoc, type RichNode } from "@ecomcx/ecomweb-content";
import type { BlockProps, Post, ResolveResult, ShortcodeProps, Site } from "./types";
import { cx } from "./utils";
import { SOCIAL_ICONS } from "./social-icons";

/**
 * Vẽ nội dung (định dạng của CMS — @ecomcx/ecomweb-content) thành React, không phụ thuộc trình soạn.
 * Hàm thuần: shortcode/khối của plugin tra qua `resolve`, bọc lỗi qua `boundary` → test được không cần Next/runtime.
 */
export interface RenderContext {
  site: Site;
  post?: Post | null;
  resolve: {
    shortcode(name: string): Promise<ComponentType<ShortcodeProps> | null>;
    /** Khối của plugin: khối cấp cao nhất và nút trong nội dung soạn thảo dùng chung một renderer (definePlugin → blocks). */
    block(type: string): Promise<ComponentType<BlockProps> | null>;
  };
  /** Bọc component của plugin (lỗi chỉ ẩn phần đó). Mặc định: không bọc. */
  boundary?(name: string, key: string, el: ReactNode): ReactNode;
  /** Khối của plugin (defineBlock) — chuẩn hoá thuộc tính + nâng phiên bản khối lưu bằng bản cũ. */
  blocks?: readonly BlockDefinition[];
  /** Chữ giao diện (vd "Tải tệp", "Mục lục"). */
  labels?: { download?: string; toc?: string };
  /** Ngữ cảnh template: trang đang xem (khối động postTitle, postContent, query… đọc từ đây). Không có = đang vẽ nội dung bài. */
  data?: ResolveResult;
  /** Vẽ khối động (@ecomcx/ecomweb-content DYNAMIC_NODES). Không có → khối động bị bỏ qua. */
  dynamic?(node: RenderNode, key: string, ctx: RenderContext, children: (ctx: RenderContext, nodes?: RenderNode[]) => Promise<ReactNode[]>): Promise<ReactNode>;
  /** Bài của vòng lặp `query` gần nhất (+ dữ liệu phân trang khi dùng danh sách của trang). */
  query?: { posts: Post[]; data?: ResolveResult };
  /** Nội dung template part theo slug (khối templatePart). */
  parts?(slug: string): Promise<ContentDoc | null>;
  partDepth?: number;
  /** Nội dung mẫu đồng bộ theo id (khối syncedPattern). */
  pattern?(ref: number): Promise<ContentDoc | null>;
  /** Plugin thay vùng (definePlugin → regions): nhận bản template part đã vẽ, trả bản thay thế. Không có = giữ nguyên. */
  region?(name: string, fallback: ReactNode): Promise<ReactNode>;
  /** CSS kiểu dáng khối (attrs.style) gom theo class — renderContent ngoài cùng tạo và xuất thành một thẻ <style>. */
  styles?: Map<string, string>;
  /** Đang vẽ bên trong nhóm nút (`buttons`): nút không bọc thêm đoạn văn. */
  inButtons?: boolean;
  /** Tiêu đề của bài (khối mục lục) — renderContent ngoài cùng tính. */
  headings?: Array<{ level: number; id: string; text: string }>;
}

// Renderer đọc thuộc tính một cách khoan dung (đã chuẩn hoá ở normalizeContent) → kiểu nới cho gọn
type Node = Omit<RichNode, "attrs" | "content" | "marks"> & { attrs?: Record<string, any>; content?: Node[]; marks?: Array<{ type: string; attrs?: Record<string, any> }> };
export type RenderNode = Node;
const DYNAMIC = new Set<string>(DYNAMIC_NODES);

const SHORTCODE = /^\s*\[([a-z0-9_-]+)((?:\s+[a-z0-9_-]+=(?:"[^"]*"|'[^']*'|[^\s\]]+))*)\s*\]\s*$/i;
const SHORTCODE_INLINE = /\[([a-z0-9_-]+)((?:\s+[a-z0-9_-]+=(?:"[^"]*"|'[^']*'|[^\s\]]+))*)\s*\]/gi;

function parseAttrs(raw: string) {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/gi)) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

const SOCIAL: Record<string, string> = {
  facebook: "Facebook", x: "X", twitter: "X", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", linkedin: "LinkedIn", zalo: "Zalo",
  github: "GitHub", threads: "Threads", pinterest: "Pinterest", telegram: "Telegram", messenger: "Messenger", email: "Email", website: "Website",
};

/** id của tiêu đề (neo cho mục lục): thuộc tính id, không thì chữ không dấu nối bằng gạch ngang. */
function headingId(node: Node): string {
  return node.attrs?.anchor ?? node.attrs?.id ?? plainText(node).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function collectHeadings(blocks: Block[]): Array<{ level: number; id: string; text: string }> {
  const out: Array<{ level: number; id: string; text: string }> = [];
  const walk = (n: Node) => {
    if (n.type === "heading") out.push({ level: Math.min(6, Math.max(1, Number(n.attrs?.level) || 2)), id: headingId(n), text: plainText(n) });
    else for (const c of n.content ?? []) walk(c);
  };
  for (const b of blocks) if (b.type === "richtext" && b.data) walk(b.data as Node);
  return out;
}

function plainText(node: Node): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join("");
}

/** Màu do người viết chọn (nhóm, chữ): chỉ nhận dạng màu CSS, không nhận chuỗi tuỳ ý (url(), dấu ;…). */
const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%deg/]+\)|[a-z]{3,20}|var\(--[\w-]+\))$/i;
const safeColor = (v: unknown) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : undefined);

const PADDING: Record<string, string> = { none: "0", small: "0.75rem", medium: "1.5rem", large: "3rem" };
const TONES: Record<string, string> = { info: "#2563eb", success: "#16a34a", warning: "#d97706", danger: "#dc2626" };

function alignStyle(attrs?: Record<string, any>): CSSProperties | undefined {
  return attrs?.textAlign && attrs.textAlign !== "left" ? { textAlign: attrs.textAlign } : undefined;
}


function renderMarks(text: ReactNode, marks: Node["marks"], key: string): ReactNode {
  let out = text;
  for (const [i, m] of (marks ?? []).entries()) {
    const k = `${key}-m${i}`;
    switch (m.type) {
      case "bold": out = <strong key={k}>{out}</strong>; break;
      case "italic": out = <em key={k}>{out}</em>; break;
      case "underline": out = <u key={k}>{out}</u>; break;
      case "strike": out = <s key={k}>{out}</s>; break;
      case "code": out = <code key={k}>{out}</code>; break;
      case "subscript": out = <sub key={k}>{out}</sub>; break;
      case "superscript": out = <sup key={k}>{out}</sup>; break;
      case "highlight": out = <mark key={k} style={m.attrs?.color ? { background: m.attrs.color } : undefined}>{out}</mark>; break;
      case "textStyle": out = m.attrs?.color ? <span key={k} style={{ color: m.attrs.color }}>{out}</span> : out; break;
      case "link": {
        const target = m.attrs?.target;
        // rel do người viết/plugin đặt (nofollow, sponsored, ugc…) + luôn noopener khi mở tab mới
        const rel = new Set(String(m.attrs?.rel ?? "").toLowerCase().split(/\s+/).filter((x) => /^[a-z-]+$/.test(x)));
        if (target === "_blank") { rel.add("noopener"); rel.add("noreferrer"); }
        out = <a key={k} href={safeUrl(m.attrs?.href)} target={target ?? undefined} rel={rel.size ? [...rel].join(" ") : undefined}>{out}</a>;
        break;
      }
    }
  }
  return out;
}

const SIDES = ["", "Top", "Right", "Bottom", "Left"];
/** Thuộc tính inline của renderer bị kiểu dáng khối thay thế (inline luôn thắng class → phải bỏ). */
function overridden(style: BlockStyle): string[] {
  const keys: string[] = [];
  if (style.padding) keys.push(...SIDES.map((x) => `padding${x}`));
  if (style.margin) keys.push(...SIDES.map((x) => `margin${x}`), "marginLeft", "marginRight");
  if (style.gap) keys.push("gap");
  if (style.width) keys.push("width");
  if (style.maxWidth) keys.push("maxWidth");
  if (style.fontSize) keys.push("fontSize");
  if (style.lineHeight) keys.push("lineHeight");
  if (style.fontWeight) keys.push("fontWeight");
  if (style.textAlign) keys.push("textAlign");
  if (style.color?.text) keys.push("color");
  if (style.color?.background) keys.push("background", "backgroundColor");
  if (style.border) keys.push(...SIDES.map((x) => `border${x}`));
  if (style.radius) keys.push("borderRadius");
  return keys;
}

/**
 * Gắn kiểu dáng (class `ecx-s-…`), biến thể (`ecx-is-…`), class riêng và neo (id) của khối vào phần tử đã vẽ
 * (không có phần tử bọc ngoài → thêm div). Giá trị đã được normalizeContent kiểm.
 */
function decorate(el: ReactNode, a: Record<string, any>, key: string, ctx: RenderContext): ReactNode {
  if (el == null || el === false) return el;
  const style = a.style && typeof a.style === "object" ? (a.style as BlockStyle) : null;
  const cls = style ? styleClass(style) : null;
  if (style && cls && ctx.styles && !ctx.styles.has(cls)) ctx.styles.set(cls, styleCss(style, cls));
  const extra = cx(cls, a.blockStyle && `ecx-is-${a.blockStyle}`, a.className);
  if (isValidElement(el) && el.type !== Fragment && typeof el.type === "string") {
    const e = el as ReactElement<{ className?: string; style?: CSSProperties; id?: string }>;
    let inline = e.props.style;
    if (inline && style) {
      const drop = new Set(overridden(style));
      inline = Object.fromEntries(Object.entries(inline).filter(([k]) => !drop.has(k))) as CSSProperties;
    }
    return cloneElement(e, { className: cx(e.props.className, extra) || undefined, style: inline, id: a.anchor ?? e.props.id });
  }
  return <div key={key} className={extra || undefined} id={a.anchor}>{el}</div>;
}

async function renderNode(node: Node, key: string, ctx: RenderContext): Promise<ReactNode> {
  const el = await renderNodeInner(node, key, ctx);
  const a = node.attrs;
  return a && (a.style || a.blockStyle || a.className || a.anchor) ? decorate(el, a, key, ctx) : el;
}

async function renderNodeInner(node: Node, key: string, ctx: RenderContext): Promise<ReactNode> {
  const children = async () => Promise.all((node.content ?? []).map((c, i) => renderNode(c, `${key}-${i}`, ctx)));
  const a = node.attrs ?? {};
  switch (node.type) {
    case "doc": return <Fragment key={key}>{await children()}</Fragment>;
    case "text": return renderMarks(node.text ?? "", node.marks, key);
    case "paragraph": {
      // Đoạn văn chỉ chứa shortcode → render component của plugin.
      const text = plainText(node);
      const sc = SHORTCODE.exec(text);
      if (sc) {
        const Comp = await ctx.resolve.shortcode(sc[1]);
        if (Comp) return wrap(ctx, `Shortcode [${sc[1]}]`, key, <Comp attrs={parseAttrs(sc[2] ?? "")} site={ctx.site} post={ctx.post} />);
        // Shortcode của plugin chưa cài/đã tắt: ẩn với người đọc thay vì hiện mã thô.
        console.warn(`[cms] Shortcode [${sc[1]}] không có plugin nào xử lý — đã ẩn khỏi trang`);
        return null;
      }
      return <p key={key} style={alignStyle(a)}>{await children()}</p>;
    }
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(a.level) || 2));
      const Tag = `h${level}` as "h2";
      const id = headingId(node);
      return <Tag key={key} id={id || undefined} style={alignStyle(a)}>{await children()}</Tag>;
    }
    case "bulletList": return <ul key={key}>{await children()}</ul>;
    case "orderedList": return <ol key={key} start={a.start && a.start !== 1 ? a.start : undefined}>{await children()}</ol>;
    case "listItem": return <li key={key}>{await children()}</li>;
    case "taskList": return <ul key={key} className="ecx-task-list task-list">{await children()}</ul>;
    case "taskItem": return <li key={key} className="ecx-task-item task-item"><input type="checkbox" checked={!!a.checked} readOnly /> {await children()}</li>;
    case "blockquote": return <blockquote key={key}>{await children()}</blockquote>;
    case "codeBlock": return <pre key={key}><code className={a.language ? `language-${a.language}` : undefined}>{plainText(node)}</code></pre>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "image": {
      // Ảnh chèn từ thư viện mang sẵn srcset (JPEG + WebP) và kích thước → responsive, không nhảy layout
      // Bề rộng hiển thị = cỡ người viết kéo trong trình soạn → trình duyệt chọn file vừa đúng
      const sizes = a.width ? `(max-width: ${a.width}px) 100vw, ${a.width}px` : (a.sizes || "(max-width: 1024px) 100vw, 1024px");
      const img = <img src={safeUrl(a.src, "")} srcSet={a.srcset || undefined} sizes={a.srcset ? sizes : undefined}
        alt={a.alt ?? ""} title={a.title ?? undefined} width={a.width ?? undefined} height={a.height ?? undefined} loading="lazy" decoding="async" />;
      const pic = a.webpSrcset ? <picture><source type="image/webp" srcSet={a.webpSrcset} sizes={sizes} />{img}</picture> : img;
      const cls = cx("ecx-image cms-image", a.align && `ecx-align-${a.align} align${a.align}`, a.mediaId && `ecx-image-${a.mediaId} cms-image-${a.mediaId}`);
      return a.caption || a.align ? <figure key={key} className={cls}>{pic}{a.caption && <figcaption>{a.caption}</figcaption>}</figure> : <Fragment key={key}>{pic}</Fragment>;
    }
    case "gallery": {
      const items = (a.images ?? []) as Array<{ src: string; srcset?: string; webpSrcset?: string; alt?: string; caption?: string; width?: number; height?: number; full?: string }>;
      const cols = Math.min(6, Math.max(1, Number(a.columns) || 3));
      return (
        <figure key={key} className={cx("ecx-gallery cms-gallery", `ecx-gallery-columns-${cols} columns-${cols}`)} style={{ display: "grid", gap: 8, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {items.map((im, i) => {
            const el = <img src={safeUrl(im.src, "")} srcSet={im.srcset || undefined} sizes={`(max-width: 768px) 50vw, ${Math.round(100 / cols)}vw`} alt={im.alt ?? ""} width={im.width} height={im.height} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", aspectRatio: "1" }} />;
            const pic = im.webpSrcset ? <picture><source type="image/webp" srcSet={im.webpSrcset} sizes={`(max-width: 768px) 50vw, ${Math.round(100 / cols)}vw`} />{el}</picture> : el;
            return <figure key={i} className="ecx-gallery-item cms-gallery-item" style={{ margin: 0 }}>{im.full ? <a href={safeUrl(im.full)}>{pic}</a> : pic}{im.caption && <figcaption>{im.caption}</figcaption>}</figure>;
          })}
          {a.caption && <figcaption className="ecx-gallery-caption cms-gallery-caption" style={{ gridColumn: "1 / -1" }}>{a.caption}</figcaption>}
        </figure>
      );
    }
    case "video":
      return <figure key={key} className="ecx-video cms-video"><video src={safeUrl(a.src, "")} poster={a.poster ? safeUrl(a.poster, "") : undefined} controls preload="metadata" playsInline style={{ width: "100%", height: "auto" }} />{a.caption && <figcaption>{a.caption}</figcaption>}</figure>;
    case "audio":
      return <figure key={key} className="ecx-audio cms-audio"><audio src={safeUrl(a.src, "")} controls preload="metadata" style={{ width: "100%" }} />{a.caption && <figcaption>{a.caption}</figcaption>}</figure>;
    case "file": {
      const isPdf = String(a.mime ?? "").includes("pdf") || /\.pdf($|\?)/i.test(String(a.src ?? ""));
      return (
        <div key={key} className="ecx-file cms-file">
          {isPdf && a.embed !== false && <object data={safeUrl(a.src, "")} type="application/pdf" style={{ width: "100%", height: 600 }} aria-label={a.name}><a href={safeUrl(a.src)}>{a.name}</a></object>}
          <a className="ecx-file-link cms-file-link" href={safeUrl(a.src)} download={a.download ? "" : undefined} target="_blank" rel="noopener">{a.name || ctx.labels?.download || "Download"}</a>
        </div>
      );
    }
    case "table": {
      // Hàng đầu toàn ô tiêu đề → <thead>
      const rows = await children();
      const head = node.content?.[0]?.content?.length && node.content[0].content.every((c) => c.type === "tableHeader");
      // Hàng cuối là chân bảng (attrs.footer) → <tfoot>
      const foot = a.footer === true && rows.length > (head ? 2 : 1);
      const body = rows.slice(head ? 1 : 0, foot ? -1 : undefined);
      return <div key={key} className="ecx-table table-wrap"><table className={a.fixed ? "is-fixed" : undefined}>{head && <thead>{rows[0]}</thead>}<tbody>{body}</tbody>{foot && <tfoot>{rows.at(-1)}</tfoot>}</table></div>;
    }
    case "tableRow": return <tr key={key}>{await children()}</tr>;
    case "tableHeader": return <th key={key} colSpan={a.colspan > 1 ? a.colspan : undefined} rowSpan={a.rowspan > 1 ? a.rowspan : undefined}>{await children()}</th>;
    case "tableCell": return <td key={key} colSpan={a.colspan > 1 ? a.colspan : undefined} rowSpan={a.rowspan > 1 ? a.rowspan : undefined}>{await children()}</td>;
    case "youtube": {
      const m = String(a.src ?? "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
      const start = Number(a.start) > 0 ? `?start=${Math.floor(Number(a.start))}` : "";
      return m ? <div key={key} className="ecx-youtube embed"><iframe src={`https://www.youtube-nocookie.com/embed/${m[1]}${start}`} allowFullScreen loading="lazy" title="YouTube" /></div> : null;
    }
    // Bố cục (@ecomcx/ecomweb-content 1.2). Cấu trúc dùng style trực tiếp → mọi theme hiển thị đúng; class `ecx-*` để theme tạo kiểu thêm (`cms-*` giữ tới 2.0).
    case "columns": {
      // Cột co giãn theo tỉ lệ độ rộng; màn hẹp (mỗi cột < 14rem) tự xuống dòng thành một cột — không cần CSS của theme
      const stack = a.stack !== false;
      const align = a.verticalAlign === "center" ? "center" : a.verticalAlign === "bottom" ? "flex-end" : "flex-start";
      const cols = await Promise.all((node.content ?? []).map(async (c, i) => {
        const w = Number(c.attrs?.width) > 0 ? Number(c.attrs?.width) : 1;
        const inner = await Promise.all((c.content ?? []).map((cc, j) => renderNode(cc, `${key}-${i}-${j}`, ctx)));
        return <div key={`${key}-${i}`} className="ecx-column cms-column" style={{ flex: `${w} 1 0`, minWidth: stack ? "min(100%, 14rem)" : 0 }}>{inner}</div>;
      }));
      return <div key={key} className={cx("ecx-columns cms-columns", a.verticalAlign && `ecx-columns-${a.verticalAlign} cms-columns-${a.verticalAlign}`)} style={{ display: "flex", flexWrap: stack ? "wrap" : "nowrap", gap: "1.5rem", alignItems: align }}>{cols}</div>;
    }
    case "column": return <div key={key} className="ecx-column cms-column">{await children()}</div>;
    case "group": {
      const bg = safeColor(a.background), fg = safeColor(a.textColor);
      const pad = PADDING[a.padding as string] ?? (bg ? PADDING.medium : undefined);
      return <div key={key} className={cx("ecx-group cms-group", a.padding && `ecx-group-${a.padding} cms-group-${a.padding}`)} style={{ background: bg, color: fg, padding: pad, borderRadius: bg ? 12 : undefined }}>{await children()}</div>;
    }
    case "callout": {
      const tone = TONES[a.tone as string] ? (a.tone as string) : "info";
      return (
        <div key={key} role="note" className={cx("ecx-callout cms-callout", `ecx-callout-${tone} cms-callout-${tone}`)}
          style={{ borderLeft: `4px solid ${TONES[tone]}`, background: `color-mix(in srgb, ${TONES[tone]} 8%, transparent)`, padding: "0.75rem 1rem", borderRadius: 8 }}>
          {a.title && <p className="ecx-callout-title cms-callout-title" style={{ margin: 0, fontWeight: 600 }}>{a.title}</p>}
          {await children()}
        </div>
      );
    }
    case "button": {
      if (!a.text) return null;
      const variant = a.variant === "secondary" || a.variant === "outline" ? a.variant : "primary";
      const target = a.target === "_blank" ? "_blank" : undefined;
      const rel = new Set(String(a.rel ?? "").toLowerCase().split(/\s+/).filter((x) => /^[a-z-]+$/.test(x)));
      if (target) { rel.add("noopener"); rel.add("noreferrer"); }
      const look: CSSProperties = variant === "outline"
        ? { border: "1px solid var(--ecx-button-bg, var(--cms-button-bg, var(--primary, currentColor)))", color: "var(--ecx-button-bg, var(--cms-button-bg, var(--primary, inherit)))" }
        : variant === "secondary"
          ? { background: "var(--ecx-button-secondary-bg, var(--cms-button-secondary-bg, rgba(127,127,127,.15)))", color: "inherit" }
          : { background: "var(--ecx-button-bg, var(--cms-button-bg, var(--primary, #18181b)))", color: "var(--ecx-button-fg, var(--cms-button-fg, #fff))" };
      const link = (
        <a key={ctx.inButtons ? key : undefined} className={cx("ecx-button cms-button", `ecx-button-${variant} cms-button-${variant}`)} href={safeUrl(a.href)} target={target} rel={rel.size ? [...rel].join(" ") : undefined}
          style={{ display: "inline-block", padding: "0.6em 1.2em", borderRadius: 8, textDecoration: "none", fontWeight: 600, lineHeight: 1.2, ...look }}>{a.text}</a>
      );
      if (ctx.inButtons) return link;
      return (
        <p key={key} className={cx("ecx-buttons cms-buttons", a.align && `ecx-buttons-${a.align} cms-buttons-${a.align}`)} style={a.align ? { textAlign: a.align } : undefined}>{link}</p>
      );
    }
    // Bộ khối cơ bản (@ecomcx/ecomweb-content 1.9)
    case "spacer":
      return <div key={key} className="ecx-spacer" style={{ height: spacingValue(a.height ?? "lg") ?? "1.5rem" }} aria-hidden="true" />;
    case "buttons": {
      const items = await Promise.all((node.content ?? []).map((c, i) => renderNode(c, `${key}-${i}`, { ...ctx, inButtons: true })));
      return <div key={key} className={cx("ecx-buttons-group", a.align && `is-${a.align}`)}>{items}</div>;
    }
    case "cover": {
      const src = a.src ? safeUrl(a.src, "") : "";
      const overlay = colorCss(a.overlay) ?? (src ? "#000" : undefined);
      return (
        <div key={key} className={cx("ecx-cover", a.contentAlign && a.contentAlign !== "center" && `is-${a.contentAlign}`, a.fixed && src && "is-fixed")}
          style={{ minHeight: spacingValue(a.minHeight ?? "400px"), backgroundImage: a.fixed && src ? `url("${src.replace(/["\\()]/g, encodeURIComponent)}")` : undefined }}>
          {src && !a.fixed && <img className="ecx-cover-img" src={src} alt={a.alt ?? ""} loading="lazy" decoding="async" />}
          {overlay && <span className="ecx-cover-overlay" aria-hidden="true" style={{ background: overlay, opacity: Math.min(100, Math.max(0, Number(a.opacity ?? 50))) / 100 }} />}
          <div className="ecx-cover-inner">{await children()}</div>
        </div>
      );
    }
    case "mediaText": {
      const width = Math.min(80, Math.max(20, Number(a.width) || 50));
      return (
        <div key={key} className={cx("ecx-media-text", a.position === "right" && "is-right", a.verticalAlign && a.verticalAlign !== "center" && `is-${a.verticalAlign}`, a.stack !== false && "is-stack")}
          style={{ ["--ecx-media-width" as string]: `${width}%` } as CSSProperties}>
          <figure className="ecx-media-text-media" style={{ margin: 0 }}>{a.src && <img src={safeUrl(a.src, "")} alt={a.alt ?? ""} loading="lazy" decoding="async" />}</figure>
          <div className="ecx-media-text-content">{await children()}</div>
        </div>
      );
    }
    case "pullquote":
      return <figure key={key} className="ecx-pullquote"><blockquote><p>{await children()}</p></blockquote>{a.citation && <figcaption>{a.citation}</figcaption>}</figure>;
    case "details":
      return <details key={key} className="ecx-details" open={a.open === true || undefined}><summary>{a.summary || "…"}</summary>{await children()}</details>;
    case "customHtml":
      // Máy chủ đã lọc HTML khi người soạn thiếu quyền unfiltered_html (ContentSanitizer)
      return a.html ? <div key={key} className="ecx-html" dangerouslySetInnerHTML={{ __html: String(a.html) }} /> : null;
    case "socialLinks": {
      const links = (Array.isArray(a.links) ? a.links : []).filter((l: any) => l && typeof l.url === "string" && typeof l.service === "string" && /^[a-z0-9-]{1,30}$/.test(l.service));
      if (!links.length) return null;
      return (
        <ul key={key} className={cx("ecx-social", `is-${a.size ?? "medium"}`, a.align && `is-${a.align}`, a.showLabels && "has-labels")}>
          {links.map((l: { service: string; url: string; label?: string }, i: number) => {
            const name = l.label || SOCIAL[l.service] || l.service;
            return (
              <li key={i}><a className={`ecx-social-${l.service}`} href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer me" aria-label={a.showLabels ? undefined : name} title={name}>
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d={SOCIAL_ICONS[l.service] ?? SOCIAL_ICONS.website} fillRule={SOCIAL_ICONS[l.service] && !["email", "website", "linkedin"].includes(l.service) ? undefined : "evenodd"} /></svg>
                {a.showLabels && <span>{name}</span>}
              </a></li>
            );
          })}
        </ul>
      );
    }
    case "tableOfContents": {
      const max = Math.min(4, Math.max(2, Number(a.maxLevel) || 3));
      const items = (ctx.headings ?? []).filter((h) => h.level >= 2 && h.level <= max && h.id);
      if (!items.length) return null;
      const title = a.title || ctx.labels?.toc || "Contents";
      return (
        <nav key={key} className="ecx-toc" aria-label={title}>
          <p className="ecx-toc-title">{title}</p>
          <ol>{items.map((h, i) => <li key={i} className={`ecx-toc-l${h.level}`} style={h.level > 2 ? { marginLeft: `${h.level - 2}em` } : undefined}><a href={`#${h.id}`}>{h.text}</a></li>)}</ol>
        </nav>
      );
    }
    case "preformatted":
      return <pre key={key} className="ecx-pre">{await children()}</pre>;
    case "embed": {
      // Khung nhúng chỉ cho nhà cung cấp đã biết; địa chỉ khung do embedInfo dựng → không nhúng được trang tuỳ ý
      const info = embedInfo(a.url);
      if (!info) return a.url ? <p key={key} className="ecx-embed-link cms-embed-link"><a href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer">{a.caption || a.url}</a></p> : null;
      const box: CSSProperties = info.aspect ? { position: "relative", aspectRatio: String(info.aspect) } : { position: "relative", height: info.height };
      return (
        <figure key={key} className={cx("ecx-embed cms-embed", `ecx-embed-${info.provider} cms-embed-${info.provider}`)} style={{ maxWidth: info.maxWidth, marginLeft: info.maxWidth ? "auto" : undefined, marginRight: info.maxWidth ? "auto" : undefined }}>
          <div style={box}>
            <iframe src={info.src} title={a.caption || info.title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 8 }} />
          </div>
          {a.caption && <figcaption>{a.caption}</figcaption>}
        </figure>
      );
    }
    default: {
      if (DYNAMIC.has(node.type))
        return ctx.dynamic ? ctx.dynamic(node, key, ctx, (c, nodes = node.content ?? []) => Promise.all(nodes.map((n, i) => renderNode(n, `${key}-${i}`, c)))) : null;
      // Nút của plugin trong nội dung soạn thảo (defineBlock) — cùng renderer với khối cấp cao nhất: definePlugin({ blocks })
      const Comp = await ctx.resolve.block(node.type);
      const inner = node.content ? await children() : null;
      if (Comp) {
        const block: Block = { type: node.type, data: a };
        return wrap(ctx, `Block ${node.type}`, key, <Comp block={block} data={a} site={ctx.site} post={ctx.post}>{inner}</Comp>);
      }
      // Plugin đã tắt/chưa cài: vẫn hiện phần chữ bên trong (nếu có), không để lại khung rỗng
      return inner ? <Fragment key={key}>{inner}</Fragment> : null;
    }
  }
}


/** HTML (vd nội dung nhập từ hệ thống cũ): thay shortcode đứng riêng bằng component. */
async function renderHtml(html: string, key: string, ctx: RenderContext): Promise<ReactNode> {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of html.matchAll(SHORTCODE_INLINE)) {
    const Comp = await ctx.resolve.shortcode(m[1]);
    if (!Comp) continue;
    if (m.index! > last) parts.push(<div key={`${key}-h${i++}`} dangerouslySetInnerHTML={{ __html: html.slice(last, m.index) }} />);
    parts.push(wrap(ctx, `Shortcode [${m[1]}]`, `${key}-s${i++}`, <Comp attrs={parseAttrs(m[2] ?? "")} site={ctx.site} post={ctx.post} />));
    last = m.index! + m[0].length;
  }
  if (last < html.length) parts.push(<div key={`${key}-h${i++}`} dangerouslySetInnerHTML={{ __html: html.slice(last) }} />);
  return <Fragment key={key}>{parts}</Fragment>;
}

async function renderBlock(block: Block, key: string, ctx: RenderContext): Promise<ReactNode> {
  switch (block.type) {
    case "richtext": return block.data ? await renderNode(block.data as Node, key, ctx) : null;
    case "html": return await renderHtml(String(block.data?.html ?? ""), key, ctx);
    default: {
      const Comp = await ctx.resolve.block(block.type);
      return Comp ? wrap(ctx, `Block ${block.type}`, key, <Comp block={block} data={block.data} site={ctx.site} post={ctx.post} />) : null;
    }
  }
}

function wrap(ctx: RenderContext, name: string, key: string, el: ReactNode): ReactNode {
  return ctx.boundary ? ctx.boundary(name, key, el) : <Fragment key={key}>{el}</Fragment>;
}

/**
 * Vẽ nội dung bài viết: chuẩn hoá theo định dạng của CMS (bài lưu bằng bản cũ được nâng cấp, cấu trúc hỏng bị bỏ),
 * rồi vẽ từng khối. Khối/nút của plugin không có renderer (plugin tắt) → bỏ qua, dữ liệu vẫn nguyên trong DB.
 */
export async function renderContent(content: ContentDoc | unknown, ctx: RenderContext, transform?: (blocks: Block[]) => Block[] | Promise<Block[]>): Promise<ReactNode[]> {
  const { doc } = normalizeContent(content, { blocks: ctx.blocks });
  const blocks = transform ? await transform(doc.blocks) : doc.blocks;
  // Lần vẽ ngoài cùng gom CSS kiểu dáng của mọi khối (kể cả phần lồng bên trong) thành một thẻ <style>
  const own = !ctx.styles;
  if (own) ctx = { ...ctx, styles: new Map(), headings: ctx.headings ?? collectHeadings(blocks) };
  const out = await Promise.all(blocks.map((b, i) => renderBlock(b, b.id ?? `b${i}`, ctx)));
  if (own && ctx.styles!.size) out.unshift(<style key="ecx-styles" data-ecx-styles="">{[...ctx.styles!.values()].join("")}</style>);
  return out;
}
