import { Fragment, cloneElement, createElement, isValidElement, type ComponentType, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ICON_PATHS } from "./icons";
import { DYNAMIC_NODES, widthClass, blockCitation, blockShell, buttonWrapShell, coverParts, linkRel, colorCss, embedInfo, motionClasses, normalizeContent, safeUrl, spacingValue, styleClass, styleCss, type BlockStyle, type Block, type BlockDefinition, type ContentDoc, type RichNode } from "@ecomcx/ecomweb-content";
import type { BlockProps, Post, ResolveResult, ShortcodeProps, Site } from "./types";
import { cx } from "./utils";
import { SOCIAL_ICONS } from "./social-icons";
import { CountdownClient, LightboxClient, TabsClient } from "./client";
import { getT } from "./i18n";

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
  /** Filter "block.render": plugin bọc / thay phần tử đã vẽ của MỌI khối (kể cả khối lõi). Chỉ có khi có plugin đăng ký filter này. */
  filterBlock?(node: Node, el: ReactNode): Promise<ReactNode>;
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
  /** Tên nhóm của khối accordion đang vẽ: các `details` con dùng chung `name` để mở một mục thì mục khác đóng. */
  accordion?: string;
  /** Bài của vòng lặp `query` gần nhất (+ dữ liệu phân trang khi dùng danh sách của trang). */
  query?: { posts: Post[]; data?: ResolveResult; pageParam?: string };
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
  /** Lấy giá trị của nguồn gắn dữ liệu (attrs.bindings). Không có → bỏ qua bindings (giữ nội dung gõ tay). */
  binding?(source: string, args: Record<string, string | number | boolean>, ctx: RenderContext): Promise<unknown>;
  /** Tiêu đề của bài (khối mục lục) — renderContent ngoài cùng tính. */
  headings?: Array<{ level: number; id: string; text: string }>;
  /** Chú thích của mark `footnote` trong nội dung đang vẽ (đánh số theo thứ tự xuất hiện). shortcut: chỉ gom trong một lần renderContent, mẫu đồng bộ lồng vào không có số. */
  footnotes?: { notes: Array<{ note: string; mark: object }>; prefix: string };
  /**
   * Đang xem bản nháp (Trình dựng / xem trực tiếp): gắn data-ecx-doc + data-ecx-path cho từng khối để khung soạn ở admin
   * biết người dùng bấm vào khối nào. `source` = tài liệu đang vẽ ("template:single", "part:header", "post:12", "pattern:3").
   */
  markBlocks?: boolean;
  source?: string;
  /** Khoá của khối richtext đang vẽ — đường dẫn khối = phần khoá sau nó (do renderBlock đặt). */
  pathRoot?: string;
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

function collectFootnotes(blocks: Block[]): Array<{ note: string; mark: object }> {
  const out: Array<{ note: string; mark: object }> = [];
  const walk = (n: Node) => {
    for (const m of n.marks ?? []) if (m.type === "footnote" && typeof m.attrs?.note === "string" && m.attrs.note) out.push({ note: m.attrs.note, mark: m });
    for (const c of n.content ?? []) walk(c);
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

/** Vẽ khối theo vỏ markup dùng chung với trình soạn (@ecomcx/ecomweb-content › blockShell): thẻ / class / style cùng một nguồn. */
function shelled(type: string, a: Record<string, any>, key: string, children: ReactNode, extra?: Record<string, unknown>, parent?: { type: string; attrs?: Record<string, any> }): ReactNode {
  const sh = blockShell(type, a, parent)!;
  return createElement(sh.tag, { key, className: sh.className, ...extra, style: sh.style, ...sh.attrs }, children);
}


function renderMarks(text: ReactNode, marks: Node["marks"], key: string, ctx?: RenderContext): ReactNode {
  let out = text;
  for (const [i, m] of (marks ?? []).entries()) {
    const k = `${key}-m${i}`;
    switch (m.type) {
      case "bold": out = <strong key={k}>{out}</strong>; break;
      case "italic": out = <em key={k}>{out}</em>; break;
      case "underline": out = <u key={k}>{out}</u>; break;
      case "strike": out = <s key={k}>{out}</s>; break;
      case "code": out = <code key={k}>{out}</code>; break;
      case "footnote": {
        const f = ctx?.footnotes;
        const n = f ? f.notes.findIndex((x) => x.mark === m) + 1 : 0;
        if (n > 0) out = <Fragment key={k}>{out}<sup className="ecx-footnote-ref" id={`fnref-${f!.prefix}-${n}`}><a href={`#fn-${f!.prefix}-${n}`}>[{n}]</a></sup></Fragment>;
        break;
      }
      case "kbd": out = <kbd key={k}>{out}</kbd>; break;
      case "subscript": out = <sub key={k}>{out}</sub>; break;
      case "superscript": out = <sup key={k}>{out}</sup>; break;
      case "highlight": out = <mark key={k} style={m.attrs?.color ? { background: m.attrs.color } : undefined}>{out}</mark>; break;
      case "textStyle": out = m.attrs?.color ? <span key={k} style={{ color: m.attrs.color }}>{out}</span> : out; break;
      case "link": {
        const target = m.attrs?.target;
        out = <a key={k} href={safeUrl(m.attrs?.href)} target={target ?? undefined} rel={linkRel(m.attrs?.rel, target)}>{out}</a>;
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
function decorate(el: ReactNode, a: Record<string, any>, key: string, ctx: RenderContext, type: string): ReactNode {
  if (el == null || el === false) return el;
  const style = a.style && typeof a.style === "object" ? (a.style as BlockStyle) : null;
  const cls = style ? styleClass(style) : null;
  if (style && cls && ctx.styles && !ctx.styles.has(cls)) ctx.styles.set(cls, styleCss(style, cls));
  const extra = cx(cls, motionClasses(style), widthClass(type, a), a.blockStyle && `ecx-is-${a.blockStyle}`, a.className);
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

/** Thuộc tính gắn được của khối lõi (ngoài danh sách bị bỏ qua). */
const BINDABLE: Record<string, readonly string[]> = { paragraph: ["content"], heading: ["content"], image: ["src", "alt", "caption"], button: ["text", "href"] };
const URL_ATTRS = new Set(["src", "href"]);
/**
 * Áp gắn dữ liệu: thay chữ / thuộc tính bằng giá trị của nguồn lúc hiển thị. Giá trị là chữ thường (không HTML), đường dẫn qua safeUrl;
 * nguồn không có / trả về rỗng → giữ nội dung gõ tay. Lỗi của nguồn (plugin) chỉ bỏ qua thuộc tính đó.
 */
async function applyBindings(node: Node, ctx: RenderContext): Promise<Node> {
  const bindings = node.attrs?.bindings as Record<string, { source: string; args?: Record<string, string | number | boolean> }> | undefined;
  const allowed = BINDABLE[node.type];
  if (!bindings || !allowed || !ctx.binding) return node;
  let out: Node = node;
  for (const [attr, b] of Object.entries(bindings)) {
    if (!allowed.includes(attr) || typeof b?.source !== "string") continue;
    let v: unknown;
    try { v = await ctx.binding(b.source, b.args ?? {}, ctx); } catch (e) { console.warn(`[cms] binding ${b.source} lỗi:`, (e as Error).message); continue; }
    if (v === null || v === undefined || v === "") continue;
    const text = String(v);
    if (attr === "content") out = { ...out, content: [{ type: "text", text }] };
    else if (URL_ATTRS.has(attr)) { const u = safeUrl(text, ""); if (u) out = { ...out, attrs: { ...out.attrs, [attr]: u } }; }
    else out = { ...out, attrs: { ...out.attrs, [attr]: text } };
  }
  return out;
}

async function renderNode(node: Node, key: string, ctx: RenderContext): Promise<ReactNode> {
  if (node.attrs?.bindings) node = await applyBindings(node, ctx);
  let el = await renderNodeInner(node, key, ctx);
  if (ctx.filterBlock && node.type !== "text" && node.type !== "doc") el = await ctx.filterBlock(node, el);
  const a = node.attrs;
  const out = a && (a.style || a.blockStyle || a.className || a.anchor || widthClass(node.type, a)) ? decorate(el, a, key, ctx, node.type) : el;
  return ctx.markBlocks && ctx.source && ctx.pathRoot != null && key.startsWith(ctx.pathRoot + "-") && !UNMARKED.has(node.type)
    ? markBlock(out, ctx.source, key.slice(ctx.pathRoot.length + 1), key)
    : out;
}

/** Nút không chọn riêng được trong khung soạn (hoặc bọc thêm thẻ sẽ sai cấu trúc HTML: li trong ul, ô trong bảng). */
const UNMARKED = new Set(["text", "hardBreak", "listItem", "taskItem", "tableRow", "tableCell", "tableHeader"]);

/** Gắn vị trí khối: thẻ HTML thì thêm thuộc tính, component thì bọc thẻ display:contents (không đổi bố cục). */
function markBlock(el: ReactNode, source: string, path: string, key: string): ReactNode {
  if (el == null || el === false) return el;
  const attrs = { "data-ecx-doc": source, "data-ecx-path": path };
  if (isValidElement(el) && typeof el.type === "string") return cloneElement(el as ReactElement<Record<string, unknown>>, attrs);
  return <div key={key} style={{ display: "contents" }} {...attrs}>{el}</div>;
}

async function renderNodeInner(node: Node, key: string, ctx: RenderContext): Promise<ReactNode> {
  const children = async () => Promise.all((node.content ?? []).map((c, i) => renderNode(c, `${key}-${i}`, ctx)));
  const a = node.attrs ?? {};
  switch (node.type) {
    case "doc": return <Fragment key={key}>{await children()}</Fragment>;
    case "text": return renderMarks(node.text ?? "", node.marks, key, ctx);
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
      return shelled("paragraph", a, key, await children());
    }
    case "heading": {
      return shelled("heading", a, key, await children(), { id: headingId(node) || undefined });
    }
    case "bulletList": return <ul key={key}>{await children()}</ul>;
    case "orderedList": return <ol key={key} start={a.start && a.start !== 1 ? a.start : undefined} reversed={a.reversed === true || undefined}>{await children()}</ol>;
    case "listItem": return <li key={key}>{await children()}</li>;
    case "taskList": return <ul key={key} className="ecx-task-list task-list">{await children()}</ul>;
    case "taskItem": return <li key={key} className="ecx-task-item task-item"><input type="checkbox" checked={!!a.checked} readOnly /> {await children()}</li>;
    case "blockquote": return shelled("blockquote", a, key, <>{await children()}{blockCitation(a) && <cite>{blockCitation(a)}</cite>}</>);
    case "codeBlock": return <pre key={key}><code className={a.language ? `language-${a.language}` : undefined}>{plainText(node)}</code></pre>;
    case "hardBreak": return <br key={key} />;
    case "pageBreak": return null;
    case "footnotes": {
      const f = ctx.footnotes;
      if (!f?.notes.length) return null;
      return (
        <aside key={key} className="ecx-footnotes">
          {a.title && <p className="ecx-footnotes-title">{a.title}</p>}
          <ol>{f.notes.map((x, i) => <li key={i} id={`fn-${f.prefix}-${i + 1}`}>{x.note} <a href={`#fnref-${f.prefix}-${i + 1}`} aria-label="↩">↩</a></li>)}</ol>
        </aside>
      );
    }
    case "icon": {
      const path = ICON_PATHS[String(a.name)];
      if (!path) return null;
      const size = Math.min(128, Math.max(12, Number(a.size) || 24));
      return <div key={key} className="ecx-icon-block" style={alignStyle(a)}><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role={a.label ? "img" : undefined} aria-label={a.label || undefined} aria-hidden={a.label ? undefined : true}><path d={path} /></svg></div>;
    }
    case "horizontalRule": return <hr key={key} />;
    case "image": {
      // Ảnh chèn từ thư viện mang sẵn srcset (JPEG + WebP) và kích thước → responsive, không nhảy layout
      // Bề rộng hiển thị = cỡ người viết kéo trong trình soạn → trình duyệt chọn file vừa đúng
      const sizes = a.width ? `(max-width: ${a.width}px) 100vw, ${a.width}px` : (a.sizes || "(max-width: 1024px) 100vw, 1024px");
      const imgSrc = safeUrl(a.src, "");
      if (!imgSrc) return null; // chưa chọn ảnh: không in <img> không có địa chỉ (hiện icon ảnh hỏng)
      const img = <img src={imgSrc} srcSet={a.srcset || undefined} sizes={a.srcset ? sizes : undefined}
        alt={a.alt ?? ""} title={a.title ?? undefined} width={a.width ?? undefined} height={a.height ?? undefined} loading="lazy" decoding="async" />;
      const bare = a.webpSrcset ? <picture><source type="image/webp" srcSet={a.webpSrcset} sizes={sizes} />{img}</picture> : img;
      // next: ảnh có liên kết (href qua safeUrl; mở tab mới thì noopener)
      const pic = a.lightbox === true && !a.href ? <LightboxClient src={safeUrl(a.src, "")} alt={a.alt ?? ""}>{bare}</LightboxClient> : a.href ? <a href={safeUrl(a.href)} target={a.linkTarget === "_blank" ? "_blank" : undefined} rel={a.linkTarget === "_blank" ? "noopener noreferrer" : undefined}>{bare}</a> : bare;
      const cls = blockShell("image", a)!.className;
      return a.caption || a.align ? <figure key={key} className={cls}>{pic}{a.caption && <figcaption>{a.caption}</figcaption>}</figure> : <Fragment key={key}>{pic}</Fragment>;
    }
    case "gallery": {
      const items = ((a.images ?? []) as Array<{ src: string; srcset?: string; webpSrcset?: string; alt?: string; caption?: string; width?: number; height?: number; full?: string }>).filter((im) => !!im?.src); // ảnh chưa chọn (không src) không vẽ <img> hỏng
      const cols = Math.min(6, Math.max(1, Number(a.columns) || 3));
      const crop = a.imageCrop !== false; // next: imageCrop=false giữ nguyên tỉ lệ ảnh
      return (
        <figure key={key} className={blockShell("gallery", a)!.className} style={blockShell("gallery", a)!.style as CSSProperties}>
          {items.map((im, i) => {
            const el = <img src={safeUrl(im.src, "")} srcSet={im.srcset || undefined} sizes={`(max-width: 768px) 50vw, ${Math.round(100 / cols)}vw`} alt={im.alt ?? ""} width={im.width} height={im.height} loading="lazy" decoding="async" style={crop ? { width: "100%", height: "100%", objectFit: "cover", aspectRatio: "1" } : { width: "100%", height: "auto" }} />;
            const pic = im.webpSrcset ? <picture><source type="image/webp" srcSet={im.webpSrcset} sizes={`(max-width: 768px) 50vw, ${Math.round(100 / cols)}vw`} />{el}</picture> : el;
            return <figure key={i} className="ecx-gallery-item cms-gallery-item" style={{ margin: 0 }}>{a.lightbox === true ? <LightboxClient src={safeUrl(im.full || im.src, "")} alt={im.alt ?? ""}>{pic}</LightboxClient> : im.full && a.linkTo !== "none" ? <a href={safeUrl(im.full)}>{pic}</a> : pic}{im.caption && <figcaption>{im.caption}</figcaption>}</figure>;
          })}
          {a.caption && <figcaption className="ecx-gallery-caption cms-gallery-caption" style={{ gridColumn: "1 / -1" }}>{a.caption}</figcaption>}
        </figure>
      );
    }
    case "video":
      return <figure key={key} className="ecx-video cms-video"><video src={safeUrl(a.src, "")} poster={a.poster ? safeUrl(a.poster, "") : undefined} controls={a.controls !== false} autoPlay={a.autoplay === true} loop={a.loop === true} muted={a.muted === true || a.autoplay === true} preload={["none", "metadata", "auto"].includes(a.preload) ? a.preload : "metadata"} playsInline={a.playsInline !== false} style={{ width: "100%", height: "auto" }} />{a.caption && <figcaption>{a.caption}</figcaption>}</figure>;
    case "audio":
      return <figure key={key} className="ecx-audio cms-audio"><audio src={safeUrl(a.src, "")} controls autoPlay={a.autoplay === true} loop={a.loop === true} preload={["none", "metadata", "auto"].includes(a.preload) ? a.preload : "metadata"} style={{ width: "100%" }} />{a.caption && <figcaption>{a.caption}</figcaption>}</figure>;
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
      if (!rows.length) return null; // bảng không có hàng nào → không vẽ <table> rỗng
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
      const cols = await Promise.all((node.content ?? []).map(async (c, i) => {
        const inner = await Promise.all((c.content ?? []).map((cc, j) => renderNode(cc, `${key}-${i}-${j}`, ctx)));
        return shelled("column", c.attrs ?? {}, `${key}-${i}`, inner, undefined, { type: "columns", attrs: a });
      }));
      return shelled("columns", a, key, cols);
    }
    case "column": return shelled("column", a, key, await children());
    case "group": return shelled("group", a, key, await children());
    case "callout": return shelled("callout", a, key, <>{a.title && <p className="ecx-callout-title cms-callout-title" style={{ margin: 0, fontWeight: 600 }}>{a.title}</p>}{await children()}</>);
    case "button": {
      if (!a.text) return null;
      const target = a.target === "_blank" ? "_blank" : undefined;
      const link = shelled("button", a, ctx.inButtons ? key : "", a.text, { href: safeUrl(a.href), target, rel: linkRel(a.rel, target) });
      if (ctx.inButtons) return link;
      return createElement(buttonWrapShell(a).tag, { key, className: buttonWrapShell(a).className, style: buttonWrapShell(a).style }, link);
    }
    // Bộ khối cơ bản (@ecomcx/ecomweb-content 1.9)
    case "spacer":
      return shelled("spacer", a, key, null);
    case "buttons": {
      const items = await Promise.all((node.content ?? []).map((c, i) => renderNode(c, `${key}-${i}`, { ...ctx, inButtons: true })));
      return shelled("buttons", a, key, items);
    }
    case "cover": {
      const { src, fixed, overlay, opacity } = coverParts(a);
      const url = src ? safeUrl(src, "") : "";
      return shelled("cover", a, key, <>
        {url && !fixed && <img className="ecx-cover-img" src={url} alt={a.alt ?? ""} loading="lazy" decoding="async" />}
        {overlay && <span className="ecx-cover-overlay" aria-hidden="true" style={{ background: overlay, opacity }} />}
        <div className="ecx-cover-inner">{await children()}</div>
      </>, undefined);
    }
    case "mediaText": return shelled("mediaText", a, key, <>
      <figure className="ecx-media-text-media" style={{ margin: 0 }}>{a.src && <img src={safeUrl(a.src, "")} alt={a.alt ?? ""} loading="lazy" decoding="async" />}</figure>
      <div className="ecx-media-text-content">{await children()}</div>
    </>);
    case "pullquote":
      // Nội dung là các khối (đoạn văn…) → không bọc <p> (<p><p> sai HTML: trình duyệt tách thẻ → React báo lệch khi hydrate);
      // chữ trần (dữ liệu cũ) mới cần <p>
      return shelled("pullquote", a, key, <><blockquote>{(node.content ?? []).every((c) => c.type === "text" || c.type === "hardBreak") ? <p>{await children()}</p> : await children()}</blockquote>{blockCitation(a) && <figcaption>{blockCitation(a)}</figcaption>}</>);
    case "accordion": {
      const sub = a.multiple === true ? ctx : { ...ctx, accordion: `ecx-acc-${key}` };
      return <div key={key} className="ecx-accordion">{await Promise.all((node.content ?? []).map((c, i) => renderNode(c, `${key}-${i}`, sub)))}</div>;
    }
    case "countdown": {
      const ms = Date.parse(String(a.target ?? ""));
      if (!Number.isFinite(ms)) return null;
      const t = await getT();
      const units = { d: t("countdown.d"), h: t("countdown.h"), m: t("countdown.m"), s: t("countdown.s") }; // theo ngôn ngữ của trang (vi: ngày/giờ/phút/giây)
      return <CountdownClient key={key} target={ms} serverNow={Date.now()} units={units} label={a.label ? String(a.label) : undefined} expiredText={a.expiredText ? String(a.expiredText) : undefined} />;
    }
    case "rating": {
      const max = Math.min(10, Math.max(1, Math.round(Number(a.max) || 5)));
      const v = Math.min(max, Math.max(0, Number(a.value) || 0));
      return (
        <div key={key} className="ecx-rating" role="img" aria-label={`${v}/${max}`}>
          {Array.from({ length: max }, (_, i) => <span key={i} aria-hidden="true" className={i < Math.round(v) ? "is-on" : "is-off"} style={{ color: i < Math.round(v) ? "#f59e0b" : "#d4d4d8" }}>★</span>)}
          {a.label && <span className="ecx-rating-label"> {String(a.label)}</span>}
        </div>
      );
    }
    case "tabs": {
      const tabs = (node.content ?? []).filter((c) => c.type === "tab");
      if (!tabs.length) return null;
      const panels = await Promise.all(tabs.map(async (t, i) => <Fragment key={i}>{await Promise.all((t.content ?? []).map((c, j) => renderNode(c, `${key}-${i}-${j}`, ctx)))}</Fragment>));
      return <TabsClient key={key} titles={tabs.map((t, i) => String(t.attrs?.title || `Tab ${i + 1}`))} panels={panels} />;
    }
    case "tab":
      return <div key={key} className="ecx-tab">{await children()}</div>;
    case "carousel": {
      const per = Math.min(4, Math.max(1, Math.round(Number(a.slidesPerView) || 1)));
      const kids = await Promise.all((node.content ?? []).map(async (c, i) => <div key={i} className="ecx-carousel-slide" style={{ scrollSnapAlign: "start" }}>{await renderNode(c, `${key}-${i}`, ctx)}</div>));
      return <div key={key} className="ecx-carousel" role="region" aria-roledescription="carousel" tabIndex={0}
        style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: `calc((100% - ${(per - 1) * 16}px) / ${per})`, gap: 16, overflowX: "auto", scrollSnapType: "x mandatory" }}>{kids}</div>;
    }
    case "shortcode": {
      const name = String(a.name ?? "");
      if (!/^[a-z0-9_-]{1,64}$/i.test(name)) return null;
      const Comp = await ctx.resolve.shortcode(name);
      return Comp ? <Comp key={key} attrs={(a.args && typeof a.args === "object" ? a.args : {}) as Record<string, string>} site={ctx.site} post={ctx.post} /> : null;
    }
    case "details":
      return <details key={key} className="ecx-details" name={ctx.accordion} open={a.open === true || undefined}><summary>{a.summary || "…"}</summary>{await children()}</details>;
    case "customHtml":
      // Máy chủ đã lọc HTML khi người soạn thiếu quyền unfiltered_html (ContentSanitizer)
      return a.html ? createElement(blockShell("customHtml", a)!.tag, { key, className: blockShell("customHtml", a)!.className, dangerouslySetInnerHTML: { __html: String(a.html) } }) : null;
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
      return shelled("embed", a, key, <>
        <div style={box}>
          <iframe src={info.src} title={a.caption || info.title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 8 }} />
        </div>
        {a.caption && <figcaption>{a.caption}</figcaption>}
      </>);
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
    case "richtext": return block.data ? await renderNode(block.data as Node, key, ctx.markBlocks ? { ...ctx, pathRoot: key } : ctx) : null;
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
  if (own) {
    const notes = collectFootnotes(blocks);
    ctx = { ...ctx, styles: new Map(), headings: ctx.headings ?? collectHeadings(blocks), footnotes: ctx.footnotes ?? (notes.length ? { notes, prefix: String(ctx.post?.id ?? "x") } : undefined) };
  }
  const out = await Promise.all(blocks.map((b, i) => renderBlock(b, b.id ?? `b${i}`, ctx)));
  if (own && ctx.styles!.size) out.unshift(<style key="ecx-styles" data-ecx-styles="">{[...ctx.styles!.values()].join("")}</style>);
  return out;
}
