import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BlockProps, ShortcodeProps, Site } from "../src/types";
import { renderContent, type RenderContext } from "../src/rich";
import { renderDynamic } from "../src/dynamic";
import { configureRuntime } from "../src/runtime";

// Hợp đồng của renderer: mỗi fixture của @ecomcx/ecomweb-content vẽ ra đúng HTML đã duyệt (snapshots/). Đổi renderer có chủ đích:
// UPDATE_SNAPSHOTS=1 node scripts/test.mjs theme-sdk, rồi xem kỹ diff.
const root = process.env.SDK_ROOT!;
const fixtures = path.join(process.env.CMS_CONTENT_DIR!, "fixtures"); // fixture hợp đồng của @ecomcx/ecomweb-content
const snapshots = path.join(root, "packages", "theme-sdk", "test", "snapshots");
const site = { name: "Test", url: "https://example.com", locale: "vi" } as unknown as Site;

function Callout({ data, children }: BlockProps) { return <aside className={`callout callout-${data.tone ?? "info"}`}>{children}</aside>; }
function ProductCard({ data }: BlockProps) { return <div className="product">#{data.productId}</div>; }
function Products({ data }: BlockProps) { return <ul className="products">{(data.ids as number[]).map((id) => <li key={id}>{id}</li>)}</ul>; }
function Hello({ attrs }: ShortcodeProps) { return <b>hello {attrs.name}</b>; }

const blocks: Record<string, (p: BlockProps) => any> = { "demo/callout": Callout, "product-card": ProductCard, "ecommerce/products": Products };
const ctx = (extra: Partial<RenderContext> = {}): RenderContext => ({
  site,
  resolve: { shortcode: async (n) => (n === "hello" ? Hello : null), block: async (t) => blocks[t] ?? null },
  ...extra,
});
const html = async (content: unknown, c = ctx()) => renderToStaticMarkup(<>{await renderContent(content, c)}</>);

for (const file of readdirSync(fixtures).filter((f) => f.endsWith(".json")).sort()) {
  const f = JSON.parse(readFileSync(path.join(fixtures, file), "utf8"));
  test(`render ${f.name}`, async () => {
    // Giờ cố định + /site giả: khối đếm ngược / chữ theo ngôn ngữ website không phụ thuộc đồng hồ và mạng
    configureRuntime({ themes: {}, plugins: {} });
    const realFetch = globalThis.fetch, realNow = Date.now;
    globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com" } : { items: [] }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    Date.now = () => Date.UTC(2026, 10, 1);
    try {
      const out = await html(f.input);
      const snap = path.join(snapshots, `${f.name}.html`);
      if (process.env.UPDATE_SNAPSHOTS || !existsSync(snap)) writeFileSync(snap, out + "\n");
      assert.equal(out + "\n", readFileSync(snap, "utf8"));
      // Vẽ đầu vào thô và bản đã chuẩn hoá cho cùng kết quả
      assert.equal(await html(f.expected), out);
    } finally { globalThis.fetch = realFetch; Date.now = realNow; }
  });
}

test("chuyển động: khối có hiệu ứng cuộn nhận class ecx-in (observer tìm thấy), hover thuần thì không", async () => {
  const out = await html({ type: "doc", content: [
    { type: "paragraph", attrs: { style: { motion: { in: "fade", repeat: true } } }, content: [{ type: "text", text: "A" }] },
    { type: "paragraph", attrs: { style: { motion: { hover: "lift" } } }, content: [{ type: "text", text: "B" }] },
  ] });
  assert.match(out, /<p class="ecx-s-\w+ ecx-in ecx-in-repeat">A<\/p>/);
  assert.match(out, /<p class="ecx-s-\w+">B<\/p>/);
});

test("nút của plugin dùng renderer khối, có nội dung con", async () => {
  const out = await html({ type: "doc", content: [{ type: "demo/callout", attrs: { tone: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Chú ý" }] }] }] });
  assert.equal(out, '<aside class="callout callout-warning"><p>Chú ý</p></aside>');
});

test("plugin đã tắt: nút giữ phần chữ bên trong, khối cấp cao nhất bỏ qua", async () => {
  const off = ctx({ resolve: { shortcode: async () => null, block: async () => null } });
  const out = await html({ version: 1, blocks: [
    { type: "richtext", data: { type: "doc", content: [{ type: "demo/callout", content: [{ type: "paragraph", content: [{ type: "text", text: "Vẫn đọc được" }] }] }, { type: "product-card", attrs: { productId: 1 } }] } },
    { type: "ecommerce/products", data: { ids: [1] } }] }, off);
  assert.equal(out, "<p>Vẫn đọc được</p>");
});

test("shortcode trong đoạn văn", async () => {
  assert.equal(await html({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: '[hello name="An"]' }] }] }), "<b>hello An</b>");
});

test("URL độc bị vô hiệu ở mọi chỗ", async () => {
  const bad = "javascript:alert(1)";
  const out = await html({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: bad } }] }] },
    { type: "image", attrs: { src: bad } }, { type: "video", attrs: { src: bad, poster: bad } }, { type: "file", attrs: { src: bad, name: "f" } },
    { type: "gallery", attrs: { images: [{ src: bad, full: bad }] } }] });
  assert.ok(!out.toLowerCase().includes("javascript:"), out);
});

test("video / audio: autoplay luôn kèm muted, loop, controls tắt được, preload ngoài danh sách về metadata", async () => {
  const v = await html({ type: "doc", content: [{ type: "video", attrs: { src: "/a.mp4", autoplay: true, loop: true, controls: false, preload: "bogus" } }] });
  assert.match(v, /autoPlay|autoplay/i);
  assert.match(v, /muted/i);
  assert.match(v, /loop/i);
  assert.ok(!/controls/i.test(v), v);
  assert.match(v, /preload="metadata"/);
  const plain = await html({ type: "doc", content: [{ type: "video", attrs: { src: "/a.mp4" } }] });
  assert.match(plain, /controls/i);
  assert.ok(!/autoplay/i.test(plain), plain);
  const au = await html({ type: "doc", content: [{ type: "audio", attrs: { src: "/a.mp3", loop: true } }] });
  assert.match(au, /loop/i);
});

test("block.render: plugin bọc được khối lõi; không đăng ký thì không có gì thay đổi", async () => {
  const doc = { type: "doc", content: [{ type: "image", attrs: { src: "/a.jpg", alt: "x" } }, { type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
  const plain = await html(doc);
  const seen: string[] = [];
  const wrapped = await html(doc, ctx({ filterBlock: async (node, el) => { seen.push(node.type); return node.type === "image" ? <div className="lightbox">{el}</div> : el; } }));
  assert.ok(wrapped.includes('<div class="lightbox"><'), wrapped);
  assert.deepEqual(seen, ["image", "paragraph"]); // text / doc không qua filter
  assert.ok(!plain.includes("lightbox"));
});

test("ảnh có liên kết, trích dẫn có nguồn, danh sách đếm ngược; liên kết độc bị bỏ", async () => {
  const out = await html({ type: "doc", content: [
    { type: "image", attrs: { src: "/a.jpg", href: "/to", linkTarget: "_blank" } },
    { type: "blockquote", attrs: { citation: "An" }, content: [{ type: "paragraph", content: [{ type: "text", text: "q" }] }] },
    { type: "orderedList", attrs: { reversed: true }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] }] },
    { type: "image", attrs: { src: "/b.jpg", href: "javascript:alert(1)" } }] });
  assert.match(out, /<a href="\/to" target="_blank" rel="noopener noreferrer"><img/);
  assert.match(out, /<cite>An<\/cite>/);
  assert.match(out, /<ol reversed/);
  assert.ok(!out.toLowerCase().includes("javascript:"), out);
});

test("khối lỗi được bọc bởi boundary", async () => {
  const names: string[] = [];
  await html({ type: "doc", content: [{ type: "demo/callout" }] }, ctx({ boundary: (name, key, el) => { names.push(name); return <section key={key}>{el}</section>; } }));
  assert.deepEqual(names, ["Block demo/callout"]);
});

test("khối defineBlock: website nâng phiên bản + ép kiểu trước khi đưa cho component của plugin", async () => {
  const { defineBlock } = await import("@ecomcx/ecomweb-content");
  const badge = defineBlock({ name: "demo/badge", title: "Nhãn", version: 2, attributes: { tone: { type: "string", enum: ["info", "danger"] }, size: { type: "integer" } },
    migrate: { 1: ({ color, ...r }) => ({ ...r, tone: color === "red" ? "danger" : "info" }) } });
  const seen: any[] = [];
  const Badge = ({ data }: BlockProps) => { seen.push(data); return <b className={`badge-${data.tone}`}>{data.size}</b>; };
  const c = ctx({ blocks: [badge], resolve: { shortcode: async () => null, block: async (t) => (t === "demo/badge" ? Badge : null) } });
  const out = await html({ type: "doc", content: [{ type: "demo/badge", attrs: { color: "red", size: "3" } }] }, c);
  assert.equal(out, '<b class="badge-danger">3</b>');
  assert.deepEqual(seen[0], { size: 3, tone: "danger", _v: 2 });
});

test("khối bố cục: màu lạ / URL độc bị bỏ, nhúng lạ thành liên kết, nút mở tab mới có noopener", async () => {
  const out = await html({ type: "doc", content: [
    { type: "group", attrs: { background: "red;background:url(https://evil.vn/x)", textColor: "#333" }, content: [{ type: "paragraph", content: [{ type: "text", text: "g" }] }] },
    { type: "button", attrs: { text: "Đi", href: "javascript:alert(1)", target: "_blank" } },
    { type: "button", attrs: { href: "https://a.vn" } },
    { type: "embed", attrs: { url: "https://evil.example/embed/1" } },
    { type: "embed", attrs: { url: "https://youtu.be/dQw4w9WgXcQ" } }] });
  assert.ok(!out.includes("evil.vn") && out.includes("color:#333"), out);
  assert.ok(out.includes('href="#"') && out.includes('rel="noopener noreferrer"'), out);
  assert.equal((out.match(/cms-button"|cms-button /g) ?? []).length, 1, "nút không có chữ không hiện");
  assert.ok(out.includes('<a href="https://evil.example/embed/1"') && !out.includes('src="https://evil.example'), out);
  assert.ok(out.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'), out);
});

test("khối động: giao cho ctx.dynamic kèm hàm vẽ con theo ngữ cảnh mới; không có ctx.dynamic thì bỏ qua", async () => {
  const doc = { type: "doc", content: [{ type: "query", content: [{ type: "postTemplate", content: [{ type: "postTitle" }] }] }, { type: "siteTitle" }] };
  assert.equal(await html(doc), "");
  const posts = [{ id: 1, title: "A" }, { id: 2, title: "B" }] as any[];
  const dynamic: RenderContext["dynamic"] = async (node, key, c, children) => {
    if (node.type === "query") return <div key={key} className="q">{await children({ ...c, query: { posts } })}</div>;
    if (node.type === "postTemplate") return <ul key={key}>{await Promise.all(c.query!.posts.map(async (p) => <li key={p.id}>{await children({ ...c, post: p })}</li>))}</ul>;
    if (node.type === "postTitle") return <h3 key={key}>{c.post?.title}</h3>;
    return <p key={key}>{node.type}</p>;
  };
  assert.equal(await html(doc, ctx({ dynamic })), '<div class="q"><ul><li><h3>A</h3></li><li><h3>B</h3></li></ul></div><p>siteTitle</p>');
});

test("mục lục: tiêu đề H2–H(maxLevel) của cả bài, neo đúng id; khoảng trống preset; màu phủ lạ bị bỏ", async () => {
  const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
  const out = await html({ type: "doc", content: [
    { type: "tableOfContents", attrs: { maxLevel: 3 } }, h(2, "Giới thiệu"), h(3, "Chi tiết"), h(4, "Sâu quá"),
    { type: "spacer", attrs: { height: "url(x)" } },
    { type: "cover", attrs: { overlay: "red;}x", src: "javascript:alert(1)" }, content: [{ type: "paragraph" }] },
  ] }, ctx({ labels: { toc: "Mục lục" } }));
  assert.ok(out.includes('<nav class="ecx-toc" aria-label="Mục lục">'), out);
  assert.ok(out.includes('href="#gioi-thieu"') && out.includes('href="#chi-tiet"') && !out.includes("Sâu quá</a>"), out);
  assert.ok(out.includes('class="ecx-spacer" style="height:1.5rem"'), out);
  assert.ok(!out.includes("javascript") && !out.includes("red;"), out);
});

test("bản nháp (Trình dựng): gắn tài liệu + vị trí cho từng khối, khối lồng trong cột, component bọc display:contents; tắt thì không gắn", async () => {
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const doc = { type: "doc", content: [p("A"), { type: "columns", content: [{ type: "column", content: [p("B")] }, { type: "column", content: [p("C")] }] }, { type: "siteTitle" },
    { type: "bulletList", content: [{ type: "listItem", content: [p("D")] }] }] };
  const dynamic: RenderContext["dynamic"] = async (node, key) => <h1 key={key}>{node.type}</h1>;
  assert.ok(!(await html(doc, ctx({ dynamic }))).includes("data-ecx"), "không phải bản nháp: không gắn");
  const out = await html(doc, ctx({ dynamic, markBlocks: true, source: "template:single" }));
  assert.ok(out.includes('<p data-ecx-doc="template:single" data-ecx-path="0">A</p>'), out);
  assert.ok(out.includes('data-ecx-path="1-0-0">B</p>') && out.includes('data-ecx-path="1-1-0">C</p>'), out);
  assert.ok(/<div[^>]*data-ecx-path="1"/.test(out), "khối cột có vị trí");
  assert.ok(out.includes('<h1 data-ecx-doc="template:single" data-ecx-path="2">siteTitle</h1>'), "khối động là thẻ HTML → gắn thẳng");
  assert.ok(!/<li[^>]*data-ecx/.test(out), "mục danh sách không gắn (giữ đúng cấu trúc ul > li)");
  assert.ok(out.includes('data-ecx-path="3-0-0">D</p>'), "đoạn trong mục danh sách vẫn chọn được");
});

// ---------------------------------------------------------------------------
// Gắn dữ liệu (@ecomcx/ecomweb-content 1.15 — attrs.bindings)
// ---------------------------------------------------------------------------
test("gắn dữ liệu: tiêu đề / đoạn / ảnh / nút lấy giá trị của nguồn; giá trị được escape, đường dẫn độc bị chặn", async () => {
  const values: Record<string, unknown> = { title: "Áo <b>đẹp</b>", price: 199000, img: "https://cdn.vn/a.jpg", bad: "javascript:alert(1)", none: null };
  const c = { ...ctx(), binding: async (source: string, args: Record<string, string | number | boolean>) => (source === "shop/product" ? values[String(args.field)] : undefined) };
  const doc = { type: "doc", content: [
    { type: "heading", attrs: { level: 2, bindings: { content: { source: "shop/product", args: { field: "title" } } } }, content: [{ type: "text", text: "gõ tay" }] },
    { type: "paragraph", attrs: { bindings: { content: { source: "shop/product", args: { field: "price" } } } }, content: [{ type: "text", text: "0đ" }] },
    { type: "paragraph", attrs: { bindings: { content: { source: "shop/product", args: { field: "none" } } } }, content: [{ type: "text", text: "giữ nguyên" }] },
    { type: "image", attrs: { src: "https://x/old.png", bindings: { src: { source: "shop/product", args: { field: "img" } }, alt: { source: "shop/product", args: { field: "title" } } } } },
    { type: "button", attrs: { text: "Mua", href: "/old", bindings: { href: { source: "shop/product", args: { field: "bad" } }, text: { source: "shop/product", args: { field: "price" } } } } },
    { type: "paragraph", attrs: { bindings: { secret: { source: "shop/product", args: { field: "title" } } } }, content: [{ type: "text", text: "thuộc tính lạ bỏ qua" }] },
  ] };
  const out = await html(doc, c as RenderContext);
  assert.match(out, /<h2[^>]*>Áo &lt;b&gt;đẹp&lt;\/b&gt;<\/h2>/);
  assert.match(out, /<p>199000<\/p>/);
  assert.match(out, /<p>giữ nguyên<\/p>/);
  assert.match(out, /<img src="https:\/\/cdn\.vn\/a\.jpg"[^>]*alt="Áo &lt;b&gt;đẹp&lt;\/b&gt;"/);
  assert.match(out, /href="\/old"/);
  assert.doesNotMatch(out, /javascript:/);
  assert.match(out, />199000<\/a>/);
  assert.match(out, /thuộc tính lạ bỏ qua/);
  // Không có bộ giải (website cũ): nội dung gõ tay
  assert.match(await html(doc), /gõ tay/);
});

test("gắn dữ liệu: nguồn lõi core/post, core/post-meta, core/site", async () => {
  const { CORE_BINDING_SOURCES } = await import("../src/bindings");
  const site = { title: "ECOMCX", tagline: "Khẩu hiệu", url: "https://e.vn", themeSettings: { logo: { url: "https://e.vn/logo.png" } } } as unknown as Site;
  const post = { title: "Bài A", excerpt: "Tóm tắt", link: "/bai-a", locale: "vi", publishedAt: "2026-11-01T00:00:00Z", author: { name: "Mai" }, featuredMedia: { url: "https://e.vn/a.jpg" }, meta: { price: 10, obj: { x: 1 } } } as never;
  const get = (s: string, args: Record<string, string>) => CORE_BINDING_SOURCES[s](args, { site, post });
  assert.equal(get("core/post", { field: "title" }), "Bài A");
  assert.equal(get("core/post", { field: "author" }), "Mai");
  assert.equal(get("core/post", { field: "featuredImage" }), "https://e.vn/a.jpg");
  assert.equal(get("core/post-meta", { key: "price" }), "10");
  assert.equal(get("core/post-meta", { key: "obj" }), undefined);
  assert.equal(get("core/site", { field: "logo" }), "https://e.vn/logo.png");
  assert.equal(get("core/post", { field: "password" }), undefined);
});

test("khối theme 1.15: tiêu đề trang lưu trữ là H1 theo ngữ cảnh, mô tả chuyên mục, breadcrumb có schema BreadcrumbList", async () => {
  // Chữ của khối theo ngôn ngữ website (getT đọc /site): trả về website tiếng Việt, không cần CMS chạy
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com" } : { items: [], total: 0 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
  const doc = (...content: unknown[]) => ({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content } }] });
  const term = { id: 3, taxonomy: "category", name: "Tin tức", slug: "tin-tuc", description: "Tin mới nhất của công ty", link: "/category/tin-tuc" };
  const data = { kind: "archive", title: "Tin tức", term, page: 1, totalPages: 1, total: 0, basePath: "/category/tin-tuc", templates: [], locale: "vi", alternates: [] } as never;
  const out = await html(doc({ type: "breadcrumbs" }, { type: "queryTitle", attrs: { prefix: true } }, { type: "termDescription" }), ctx({ data, dynamic: renderDynamic }));
  assert.match(out, /<h1 class="ecx-query-title">Chuyên mục: Tin tức<\/h1>/);
  assert.equal((out.match(/<h1/g) ?? []).length, 1);
  assert.match(out, /<div class="ecx-term-description">Tin mới nhất của công ty<\/div>/);
  assert.match(out, /<nav class="ecx-breadcrumbs" aria-label="Đường dẫn"><ol><li><a href="\/(vi)?">Trang chủ<\/a><\/li><li><span class="ecx-breadcrumbs-sep" aria-hidden="true">›<\/span><span aria-current="page">Tin tức<\/span><\/li><\/ol>/);
  const ld = JSON.parse(out.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
  assert.equal(ld["@type"], "BreadcrumbList");
  assert.deepEqual(ld.itemListElement.map((i: { name: string; item?: string }) => [i.name, i.item]), [["Trang chủ", "https://example.com/vi"], ["Tin tức", undefined]]);
  // Plugin SEO tự in BreadcrumbList → filter breadcrumbs.schema trả null: vẫn vẽ đường dẫn, không in schema thứ hai
  configureRuntime({ themes: {}, plugins: { seo: async () => ({ default: { filters: { "breadcrumbs.schema": () => null } } }) } as never });
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: ["seo"], activeTheme: null } : { items: [], total: 0 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  const noLd = await html(doc({ type: "breadcrumbs" }), ctx({ data, dynamic: renderDynamic, site: { title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: ["seo"], activeTheme: null } as never }));
  assert.match(noLd, /<nav class="ecx-breadcrumbs"/);
  assert.doesNotMatch(noLd, /application\/ld\+json/);
  configureRuntime({ themes: {}, plugins: {} });
  // Tìm kiếm
  const search = await html(doc({ type: "queryTitle" }), ctx({ data: { kind: "search", search: "áo thun", title: "", page: 1, totalPages: 1, total: 0, basePath: "/", templates: [], locale: "vi", alternates: [] } as never, dynamic: renderDynamic }));
  assert.match(search, /<h1 class="ecx-query-title">Kết quả tìm kiếm: áo thun<\/h1>/);
  // Ngoài template (nội dung bài, không có ngữ cảnh trang): không vẽ
  assert.equal(await html(doc({ type: "queryTitle" }, { type: "breadcrumbs" }), ctx({ dynamic: renderDynamic })), "");
  } finally { globalThis.fetch = origFetch; }
});

test("accordion: details con dùng chung name (mở một đóng các mục khác); multiple=true thì không; rating và countdown vẽ đúng, ngày hỏng bị bỏ", async () => {
  const item = (s: string) => ({ type: "details", attrs: { summary: s }, content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] });
  const one = await html({ type: "doc", content: [{ type: "accordion", attrs: {}, content: [item("A"), item("B")] }] });
  assert.match(one, /class="ecx-accordion has-icon-arrow"/);
  assert.equal((one.match(/name="ecx-acc-[^"]+"/g) ?? []).length, 2);
  assert.equal(new Set(one.match(/name="ecx-acc-[^"]+"/g)).size, 1);
  const many = await html({ type: "doc", content: [{ type: "accordion", attrs: { multiple: true }, content: [item("A")] }] });
  assert.doesNotMatch(many, /<details[^>]* name=/);
  const stars = await html({ type: "doc", content: [{ type: "rating", attrs: { value: 3.6, max: 5, label: "ok" } }] });
  assert.equal((stars.match(/is-on/g) ?? []).length, 4);
  assert.match(stars, /aria-label="3\.6\/5"/);
  // Đơn vị đếm ngược theo ngôn ngữ website (getT đọc /site): tiếng Việt → ngày/giờ/phút/giây
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com" } : { items: [], total: 0 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const cd = await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "2999-01-01T00:00:00Z", label: "Sale" } }] });
    assert.match(cd, /ecx-countdown/);
    assert.match(cd, /Sale/);
    assert.match(cd, /<small>ngày<\/small>.*<small>giây<\/small>/);
    assert.equal(await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "không phải ngày" } }] }), "");
    // Múi giờ: mốc theo giờ tường của múi giờ được chọn vẫn vẽ khối; múi giờ lạ bị bỏ nhưng mốc vẫn dùng được
    assert.match(await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "2999-01-01T09:00", timezone: "Asia/Ho_Chi_Minh" } }] }), /ecx-countdown/);
    assert.match(await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "2999-01-01T09:00", timezone: "Mars/Olympus" } }] }), /ecx-countdown/);
  } finally { globalThis.fetch = origFetch; }
});

test("gallery: linkTo=none bỏ liên kết, imageCrop=false giữ tỉ lệ ảnh", async () => {
  const img = { src: "/a.jpg", full: "/a-full.jpg", alt: "a" };
  const g = await html({ type: "doc", content: [{ type: "gallery", attrs: { images: [img], linkTo: "none", imageCrop: false } }] });
  assert.doesNotMatch(g, /<a /);
  assert.doesNotMatch(g, /object-fit:cover/);
  const g2 = await html({ type: "doc", content: [{ type: "gallery", attrs: { images: [img] } }] });
  assert.match(g2, /<a href="\/a-full\.jpg"/);
  assert.match(g2, /object-fit:cover/);
});

test("mục lục 1.26: khoảng cấp, thu gọn (details), danh sách không dấu 2 cột, tô mục đang đọc", async () => {
  const h = (level: number, t: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: t }] });
  const out = await html({ type: "doc", content: [{ type: "tableOfContents", attrs: { minLevel: 3, maxLevel: 4, collapsible: true, startCollapsed: true, listStyle: "none", columns: 2, highlight: true, smoothScroll: true } }, h(2, "Hai"), h(3, "Ba"), h(4, "Bốn"), h(5, "Năm")] });
  assert.match(out, /<nav class="ecx-toc is-smooth"/);
  assert.match(out, /<details class="ecx-toc-details"><summary class="ecx-toc-title">/);
  assert.match(out, /<ul class="ecx-toc-list is-plain has-cols-2">/);
  assert.doesNotMatch(out, />Hai<\/a>/); assert.doesNotMatch(out, />Năm<\/a>/);
  assert.match(out, />Ba<\/a>/); assert.match(out, /margin-left:1em[^>]*><a[^>]*>Bốn/);
  assert.match(out, /<span hidden="">|<span hidden>/);
});

test("hộp icon 1.26: cả hộp là link (tiêu đề không lồng <a>), nút Xem thêm, media số", async () => {
  const box = await html({ type: "doc", content: [{ type: "iconBox", attrs: { title: "Giao nhanh", href: "/giao", linkMode: "box", hover: "grow", iconStyle: "circle" } }] });
  assert.match(box, /^<a class="ecx-icon-box is-top has-hover-grow is-link" href="\/giao"/);
  assert.equal((box.match(/<a /g) ?? []).length, 1);
  assert.match(box, /ecx-icon-box-icon is-circle/);
  const more = await html({ type: "doc", content: [{ type: "iconBox", attrs: { title: "Bước", media: "number", number: "01", href: "/b", linkMode: "button", buttonText: "Xem thêm" } }] });
  assert.match(more, /<span class="ecx-icon-box-icon is-number"><span>01<\/span><\/span>/);
  assert.match(more, /<h3 class="ecx-icon-box-title"><span>Bước<\/span><\/h3>/);
  assert.match(more, /class="ecx-icon-box-more"><a href="\/b"><span>Xem thêm<\/span><\/a>/);
});

test("nút 1.26: chỉ icon (chữ thành aria-label, không hiện chữ), icon hiện khi rê, nhóm nút dọc", async () => {
  const out = await html({ type: "doc", content: [{ type: "buttons", attrs: { orientation: "vertical" }, content: [
    { type: "button", attrs: { text: "Giỏ hàng", href: "/gio", icon: "star", iconOnly: true } },
    { type: "button", attrs: { text: "Xem", href: "/xem", icon: "arrowRight", iconPosition: "right", iconReveal: true } }] }] });
  assert.match(out, /class="ecx-buttons-group is-vertical"/);
  assert.match(out, /class="[^"]*is-icon-only[^"]*"[^>]*aria-label="Giỏ hàng"|aria-label="Giỏ hàng"[^>]*class="[^"]*is-icon-only/);
  assert.doesNotMatch(out, />Giỏ hàng</);
  assert.match(out, /is-icon-reveal/);
  assert.match(out, /Xem<svg/);
});

test("accordion 1.26: 2 cột, icon dấu cộng bên trái, tiêu đề mục h3, FAQ Schema thoát </script>", async () => {
  const out = await html({ type: "doc", content: [{ type: "accordion", attrs: { columns: 2, icon: "plus", iconSide: "left", titleTag: "h3", faq: true }, content: [
    { type: "details", attrs: { summary: "Giao bao lâu?" }, content: [{ type: "paragraph", content: [{ type: "text", text: "2 giờ </script><b>" }] }] }] }] });
  assert.match(out, /class="ecx-accordion is-cols-2 has-icon-plus is-icon-left"/);
  assert.match(out, /<summary><h3 class="ecx-details-title">Giao bao lâu\?<\/h3><\/summary>/);
  const ld = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
  assert.doesNotMatch(ld, /</);
  assert.equal(JSON.parse(ld).mainEntity[0].acceptedAnswer.text, "2 giờ </script><b>");
});

test("tabs 1.26: dọc, accordion trên điện thoại, icon, phụ đề, neo (neo xấu bị bỏ)", async () => {
  const para = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  const out = await html({ type: "doc", content: [{ type: "tabs", attrs: { orientation: "vertical", mobileAccordion: true }, content: [
    { type: "tab", attrs: { title: "Một", icon: "star", subtitle: "Phụ", anchor: "mot" }, content: [para("a")] },
    { type: "tab", attrs: { title: "Hai", anchor: "x\" onclick=\"y" }, content: [para("b")] }] }] });
  assert.match(out, /class="ecx-tabs is-vertical has-mobile-accordion"/);
  assert.match(out, /aria-orientation="vertical"/);
  assert.match(out, /<svg class="ecx-tab-icon"/);
  assert.match(out, /<small class="ecx-tab-subtitle">Phụ<\/small>/);
  assert.match(out, /role="tabpanel" id="mot"/);
  assert.doesNotMatch(out, /onclick/);
});

test("tabs: mọi panel có trong HTML (SEO), tab đầu hiện; carousel snap; shortcode chỉ chạy tên hợp lệ; lightbox bọc ảnh bằng nút", async () => {
  const para = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  const tabs = await html({ type: "doc", content: [{ type: "tabs", content: [{ type: "tab", attrs: { title: "Một" }, content: [para("nội dung 1")] }, { type: "tab", attrs: { title: "Hai" }, content: [para("nội dung 2")] }] }] });
  assert.match(tabs, /role="tablist"/);
  assert.equal((tabs.match(/role="tab"/g) ?? []).length, 2);
  assert.match(tabs, /nội dung 1/); assert.match(tabs, /nội dung 2/);
  assert.equal((tabs.match(/<div[^>]*role="tabpanel"[^>]*hidden/g) ?? []).length, 1);
  const car = await html({ type: "doc", content: [{ type: "carousel", attrs: { slidesPerView: 2 }, content: [para("a"), para("b"), para("c")] }] });
  assert.match(car, /scroll-snap-type:x mandatory/);
  assert.equal((car.match(/ecx-carousel-slide/g) ?? []).length, 3);
  const sc = await html({ type: "doc", content: [{ type: "shortcode", attrs: { name: "hello", args: { name: "A" } } }] });
  assert.match(sc, /hello A/);
  assert.equal(await html({ type: "doc", content: [{ type: "shortcode", attrs: { name: "x<script>" } }] }), "");
  const lb = await html({ type: "doc", content: [{ type: "image", attrs: { src: "/a.jpg", alt: "a", lightbox: true } }, { type: "gallery", attrs: { images: [{ src: "/b.jpg", full: "/b-full.jpg" }], lightbox: true } }] });
  assert.equal((lb.match(/ecx-lightbox-trigger/g) ?? []).length, 2);
  assert.doesNotMatch(lb, /<a href="\/b-full\.jpg"/);
});

test("readMore / commentsCount / avatar / queryTotal / author bio / pagination type", async () => {
  const post = { id: 1, link: "/bai-1", commentCount: 7, author: { id: 2, name: "An", slug: "an", avatarUrl: "/an.png", bio: "Biên tập viên" } } as never;
  const out = await html({ type: "doc", content: [{ type: "readMore", attrs: { text: "Xem tiếp" } }, { type: "commentsCount" }, { type: "avatar", attrs: { size: 64, link: false } }, { type: "postAuthor", attrs: { showBio: true } }] }, ctx({ post, dynamic: renderDynamic }));
  assert.match(out, /href="\/bai-1"[^>]*>Xem tiếp</);
  assert.match(out, /class="ecx-comments-count"[^>]*>7</);
  assert.match(out, /<img src="\/an\.png" alt="An" width="64" height="64"/);
  assert.match(out, /Biên tập viên/);
  const qt = await html({ type: "doc", content: [{ type: "queryTotal" }] }, ctx({ query: { posts: [], data: { total: 42, page: 1, totalPages: 1 } as never }, dynamic: renderDynamic }));
  assert.match(qt, /ecx-query-total[^>]*>42</);
});

test("termList / pageList / archives / mark kbd", async () => {
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
  const terms = [{ id: 1, name: "Tin", link: "/category/tin", count: 9, parentId: null }, { id: 2, name: "Con", link: "/category/con", count: 3, parentId: 1 }];
  const pages = [{ id: 10, title: "Về chúng tôi", link: "/ve", parentId: null }, { id: 11, title: "Đội ngũ", link: "/ve/doi-ngu", parentId: 10 }];
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    if (/\/site\b/.test(url)) return json({ title: "Test", language: "vi", locale: "vi", url: "https://example.com" });
    if (/\/terms\/category/.test(url)) return json(terms);
    if (/\/archives/.test(url)) return json([{ year: 2026, month: 11, count: 4, link: "/2026/11" }, { year: 2026, month: 10, count: 2, link: "/2026/10" }]);
    return json({ items: pages, total: 2, page: 1, totalPages: 1 });
  }) as typeof fetch;
  try {
    const doc = (...content: unknown[]) => ({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content } }] });
    const out = await html(doc(
      { type: "termList", attrs: { showCount: true, hierarchical: true } },
      { type: "termList", attrs: { display: "cloud" } },
      { type: "termList", attrs: { taxonomy: "x/../y" } },
      { type: "pageList", attrs: { depth: 1 } },
      { type: "archives", attrs: { limit: 1, showCount: false } },
    ), ctx({ dynamic: renderDynamic }));
    assert.match(out, /<li><a [^>]*href="\/category\/tin"[^>]*>Tin<\/a> \(9\)<ul><li><a [^>]*>Con<\/a> \(3\)<\/li><\/ul><\/li>/);
    assert.match(out, /ecx-term-list is-cloud/);
    assert.equal((out.match(/ecx-term-list/g) ?? []).length, 2); // taxonomy sai bị bỏ
    assert.match(out, /ecx-page-list"><ul><li><a [^>]*>Về chúng tôi<\/a><\/li><\/ul>/); // depth 1: không có con
    assert.equal((out.match(/<li><a href="\/2026\//g) ?? []).length, 1);
    assert.doesNotMatch(out.slice(out.indexOf("ecx-archives")), /\(4\)/);
    const k = await html(doc({ type: "paragraph", content: [{ type: "text", text: "Ctrl", marks: [{ type: "kbd" }] }] }));
    assert.match(k, /<kbd>Ctrl<\/kbd>/);
  } finally { globalThis.fetch = origFetch; }
});

test("varyHeader: chỉ chiều hợp lệ, giá trị chữ thường, rỗng thì không gửi", async () => {
  const { varyHeader } = await import("../src/api");
  assert.deepEqual(varyHeader({ device: "Mobile", "flag:ab": "B" }), { "X-CMS-Vary": "device=mobile,flag:ab=b" });
  assert.deepEqual(varyHeader({ cookie: "x", "flag:ok": "a b", device: "" }), {});
  assert.deepEqual(varyHeader(), {});
});

test("icon / footnotes / loginout / pageBreak", async () => {
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: [], activeTheme: null } : { items: [], total: 0 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const doc = (...content: unknown[]) => ({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content } }] });
    const ic = await html(doc({ type: "icon", attrs: { name: "mail", size: 40, label: "Thư" } }, { type: "icon", attrs: { name: "evil" } }));
    assert.equal((ic.match(/<svg/g) ?? []).length, 1);
    assert.match(ic, /width="40"[^>]*role="img" aria-label="Thư"/);
    const fn = await html(doc(
      { type: "paragraph", content: [{ type: "text", text: "A", marks: [{ type: "footnote", attrs: { note: "Nguồn <b>1</b>" } }] }, { type: "text", text: " B", marks: [{ type: "footnote", attrs: { note: "Nguồn 2" } }] }] },
      { type: "footnotes", attrs: { title: "Chú thích" } },
    ), ctx({ post: { id: 7 } as never }));
    assert.match(fn, /id="fnref-7-1"><a href="#fn-7-1">\[1\]<\/a>/);
    assert.match(fn, /id="fnref-7-2"/);
    assert.match(fn, /<li id="fn-7-1">Nguồn &lt;b&gt;1&lt;\/b&gt; <a href="#fnref-7-1"/);
    assert.equal(await html(doc({ type: "footnotes" })), ""); // không có chú thích → không vẽ
    const lo = await html(doc({ type: "loginout" }), ctx({ dynamic: renderDynamic }));
    assert.match(lo, /ecx-loginout/);
    // pageBreak: mỗi trang một đoạn + thanh chuyển trang
    const paged = doc({ type: "paragraph", content: [{ type: "text", text: "Một" }] }, { type: "pageBreak" }, { type: "paragraph", content: [{ type: "text", text: "Hai" }] });
    const post = { id: 1, link: "/bai", content: paged } as never;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PostContent } = await import("../src/content");
    const p1 = renderToStaticMarkup(await PostContent({ post }));
    assert.match(p1, /Một/); assert.doesNotMatch(p1, /Hai/);
    assert.match(p1, /rel="next"[^>]*>Sau »|href="\/bai\?trang=2"/);
    const p2 = renderToStaticMarkup(await PostContent({ post, page: 2 }));
    assert.match(p2, /Hai/); assert.doesNotMatch(p2, /Một/);
    assert.match(p2, /href="\/bai"/);
    assert.match(renderToStaticMarkup(await PostContent({ post, page: 99 })), /Hai/); // vượt quá → trang cuối
  } finally { globalThis.fetch = origFetch; }
});

test("comments: perPage / order đi vào URL lấy bình luận, avatarSize và showDate ảnh hưởng HTML", async () => {
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  const urls: string[] = [];
  const reply = { id: 1, postId: 5, parentId: null, authorName: "An", content: "Hi", createdAt: "2026-11-05T00:00:00Z", status: "approved", replies: [], avatarUrl: "/a.png" };
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u); urls.push(url);
    const body = /\/site\b/.test(url) ? { title: "T", language: "vi", locale: "vi", url: "https://example.com", activePlugins: [], activeTheme: null } : /\/comments\//.test(url) ? { items: [reply], total: 1, totalAll: 1, page: 1, totalPages: 1 } : { items: [], total: 0 };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { getComments } = await import("../src/api");
    const { CommentList } = await import("../src/client");
    await getComments(5, 2, undefined, { perPage: 5, order: "asc" });
    const u = urls.find((x) => /\/comments\//.test(x))!;
    assert.match(u, /page=2/); assert.match(u, /perPage=5/); assert.match(u, /order=asc/);
    const site = { dateFormat: "dd/MM/yyyy", timezone: "UTC", locale: "vi" };
    const out = renderToStaticMarkup(<CommentList comments={[reply as never]} site={site as never} avatarSize={64} showDate={false} />);
    assert.match(out, /width="64" height="64"/);
    assert.doesNotMatch(out, /<time/);
    assert.match(renderToStaticMarkup(<CommentList comments={[reply as never]} site={site as never} />), /width="40"[^>]*>.*<time/s);
  } finally { globalThis.fetch = origFetch; }
});

test("SearchFormClient: postType thành input ẩn, showLabel hiện nhãn, nút bên trái", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SearchFormClient } = await import("../src/client");
  const out = renderToStaticMarkup(<SearchFormClient action="/" placeholder="p" label="Từ khoá" buttonLabel="Tìm" postType="page" showLabel buttonPosition="left" />);
  assert.match(out, /<input type="hidden" name="type" value="page"/);
  assert.match(out, /<label [^>]*>Từ khoá<\/label>/);
  assert.ok(out.indexOf("<button") < out.indexOf('type="search"'));
  assert.doesNotMatch(renderToStaticMarkup(<SearchFormClient action="/" placeholder="p" label="L" buttonLabel="B" />), /name="type"/);
});

test("ảnh chưa có địa chỉ (hoặc địa chỉ không an toàn) không in <img> hỏng", async () => {
  const out = await html({ type: "doc", content: [{ type: "image", attrs: { alt: "chưa chọn ảnh" } }, { type: "image", attrs: { src: "", alt: "rỗng" } }, { type: "image", attrs: { src: "/ok.jpg", alt: "ok" } }] });
  assert.doesNotMatch(out, /chưa chọn ảnh|rỗng/);
  assert.match(out, /<img[^>]+src="\/ok\.jpg"/);
});

test("ảnh đại diện có link mà chưa có alt: link lấy tiêu đề bài làm tên (trình đọc màn hình không chỉ đọc 'liên kết')", async () => {
  const { FeaturedImage } = await import("../src/components");
  const media = { id: 1, url: "/uploads/a.png", width: 800, height: 600, alt: "", caption: "", sizes: {} } as never;
  const noAlt = renderToStaticMarkup(<FeaturedImage media={media} link="/bai-viet" label="Tiêu đề bài" />);
  assert.match(noAlt, /<a [^>]*aria-label="Tiêu đề bài"/);
  const withAlt = renderToStaticMarkup(<FeaturedImage media={{ ...(media as object), alt: "Ảnh bìa" } as never} link="/bai-viet" label="Tiêu đề bài" />);
  assert.doesNotMatch(withAlt, /aria-label/);
  assert.doesNotMatch(renderToStaticMarkup(<FeaturedImage media={media} label="Tiêu đề bài" />), /aria-label/);
});

test("không có <p> lồng trong <p> (HTML sai → trình duyệt tách thẻ, React báo lệch khi hydrate) — mọi khối chứa đoạn văn", async () => {
  const para = { type: "paragraph", content: [{ type: "text", text: "x" }] };
  const doc = (n: unknown) => ({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content: [n] } }] });
  for (const type of ["pullquote", "blockquote", "callout", "group", "details", "cover"]) {
    const out = await html(doc({ type, attrs: type === "details" ? { summary: "s" } : {}, content: [para, para] }));
    assert.doesNotMatch(out, /<p[^>]*>(?:(?!<\/p>).)*<p[\s>]/s, `${type}: ${out}`);
  }
  // pullquote dữ liệu cũ (chữ trần) vẫn có <p>
  assert.match(await html(doc({ type: "pullquote", content: [{ type: "text", text: "cu" }] })), /<blockquote><p>cu<\/p><\/blockquote>/);
});

test("form cơ bản (1.39): ô vẽ ở máy chủ có nhãn / id / required, ô bẫy ẩn, ô sai tên bị bỏ; không có nguồn thì không vẽ", async () => {
  const form = { type: "form", attrs: { formId: "f_abc123", submitText: "Gửi liên hệ" }, content: [
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Liên hệ" }] },
    { type: "formField", attrs: { kind: "text", name: "name", label: "Họ tên", required: true, width: "half" } },
    { type: "formField", attrs: { kind: "email", name: "email", label: "Email", help: "Không công khai" } },
    { type: "formField", attrs: { kind: "select", name: "topic", label: "Chủ đề", options: ["Báo giá", "Khác"] } },
    { type: "formField", attrs: { kind: "consent", name: "consent", label: "Tôi đồng ý với [điều khoản](/dieu-khoan) và [x](javascript:alert(1))", required: true } },
    { type: "formField", attrs: { kind: "text", name: "Bad Name", label: "Sai" } },
    { type: "formField", attrs: { kind: "text", name: "ten", label: "Tên", width: "third", autocomplete: "given-name" } },
    { type: "formField", attrs: { kind: "text", name: "ghi_chu", label: "Ghi chú", autocomplete: "x\" onfocus=\"y" } },
  ] };
  const doc = { type: "doc", content: [form] };
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: [], activeTheme: null }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  let out = "";
  try {
    assert.equal(await html(doc), "");
    out = await html(doc, ctx({ source: "post:12" }));
  } finally { globalThis.fetch = origFetch; }
  assert.match(out, /<form class="ecx-form-blocks" novalidate="" data-form="f_abc123">/i);
  assert.match(out, /<div class="ecx-field is-text is-half" data-field="name"><label for="f_abc123-name">Họ tên<span class="ecx-field-required" aria-hidden="true"> \*<\/span><\/label>/);
  assert.match(out, /<input type="text"[^>]*id="f_abc123-name"[^>]*required=""[^>]*name="name"/);
  assert.match(out, /aria-describedby="f_abc123-email-help f_abc123-email-error"/);
  assert.match(out, /<option value="Báo giá">Báo giá<\/option>/);
  assert.match(out, /<input type="checkbox" id="f_abc123-consent" required=""[^>]*name="consent" value="1"/);
  // Nhãn ô đồng ý: [chữ](đường-dẫn) → link mở tab mới; đường dẫn không an toàn → chỉ còn chữ
  assert.match(out, /Tôi đồng ý với <a href="\/dieu-khoan" target="_blank" rel="noopener noreferrer">điều khoản<\/a> và x/);
  assert.doesNotMatch(out, /javascript:/);
  // 1.26: ô 1/3 hàng, autocomplete theo ô; giá trị lạ bị bỏ
  assert.match(out, /<div class="ecx-field is-text is-third" data-field="ten">/);
  assert.match(out, /autoComplete="given-name"/i);
  assert.doesNotMatch(out, /onfocus/);
  assert.match(out, /name="_hp"/);
  assert.match(out, /class="ecx-button cms-button ecx-button-primary[^"]*"[^>]*>Gửi liên hệ<\/button>/);
  assert.doesNotMatch(out, /Bad Name|>Sai</);
});

test("cột có liên kết phủ: thêm <a> phủ cả cột (tab mới có rel), cột position:relative; đường dẫn không an toàn thì bỏ", async () => {
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const col = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "columns", content: [{ type: "column", attrs, content: [p("A")] }] }] });
  const out = await html(col({ href: "/gioi-thieu", linkTarget: "_blank", linkLabel: "Giới thiệu" }), ctx());
  assert.match(out, /<a[^>]*class="ecx-overlay-link"[^>]*>/, out);
  assert.ok(out.includes('href="/gioi-thieu"') && out.includes('aria-label="Giới thiệu"') && out.includes('rel="noopener noreferrer"') && out.includes("position:relative"), out);
  assert.ok(!(await html(col({ href: "javascript:alert(1)" }), ctx())).includes("ecx-overlay-link"));
  assert.ok(!(await html(col({}), ctx())).includes("ecx-overlay-link"));
});

test("khối chứa đổi thẻ HTML (tagName): nhóm thành <section>, cột thành <article>; thẻ lạ vẫn là <div>", async () => {
  const p = { type: "paragraph", content: [{ type: "text", text: "A" }] };
  const out = await html({ type: "doc", content: [
    { type: "group", attrs: { tagName: "section" }, content: [p] },
    { type: "columns", attrs: { tagName: "script" }, content: [{ type: "column", attrs: { tagName: "article" }, content: [p] }] },
  ] }, ctx());
  assert.match(out, /<section[^>]*class="[^"]*ecx-group/, out);
  assert.match(out, /<article[^>]*class="[^"]*ecx-column /, out);
  assert.match(out, /<div[^>]*class="[^"]*ecx-columns /, out);
  assert.ok(!out.includes("<script"), out);
});

test("khối icon: độ dày nét, khung tròn có đệm theo cỡ, liên kết tab mới; đường dẫn không an toàn thì không có <a>", async () => {
  const icon = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "icon", attrs }] });
  const out = await html(icon({ name: "heart", size: 40, stroke: 1.5, iconStyle: "circle", href: "/lien-he", linkTarget: "_blank" }), ctx());
  assert.match(out, /<a[^>]*class="ecx-icon-shape is-circle"[^>]*>/, out);
  assert.ok(out.includes('href="/lien-he"') && out.includes('rel="noopener noreferrer"') && out.includes("padding:16px") && out.includes('stroke-width="1.5"'), out);
  const bad = await html(icon({ name: "star", href: "javascript:alert(1)" }), ctx());
  assert.ok(!bad.includes("<a") && bad.includes('<span class="ecx-icon-shape"') && bad.includes('stroke-width="2"'), bad);
});

test("danh sách icon: 3 cột, icon căn giữa có khung tròn, nét mảnh; mục icon \"none\" không vẽ icon", async () => {
  const out = await html({ type: "doc", content: [{ type: "iconList", attrs: { columns: 3, iconAlign: "center", iconStyle: "circle", stroke: 1.5, items: [{ text: "A", icon: "none" }, { text: "B", href: "/b" }] } }] }, ctx());
  assert.match(out, /<ul class="ecx-icon-list is-cols-3 is-icon-center has-icon-circle[^"]*"/, out);
  assert.equal(out.match(/ecx-widget-icon/g)?.length, 1, out);
  assert.ok(out.includes('stroke-width="1.5"') && out.includes('href="/b"'), out);
});

test("hộp icon: media là ảnh nằm trái, căn giữa theo chiều dọc, cao bằng ô chứa; ảnh có đường dẫn nguy hiểm thì không vẽ", async () => {
  const box = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "iconBox", attrs: { title: "A", media: "image", ...attrs } }] });
  const out = await html(box({ src: "/uploads/a.jpg", alt: "Ảnh A", width: 640, height: 480, position: "left", verticalAlign: "center", fullHeight: true, iconStyle: "circle" }), ctx());
  assert.match(out, /class="ecx-icon-box is-left is-v-center is-full-height[^"]*"/, out);
  assert.match(out, /<span class="ecx-icon-box-icon is-image"><img[^>]*src="\/uploads\/a\.jpg"[^>]*alt="Ảnh A"[^>]*width="640"[^>]*height="480"/, out);
  assert.ok(!out.includes("ecx-widget-icon"), out);
  const bad = await html(box({ src: "javascript:alert(1)", verticalAlign: "center" }), ctx());
  assert.ok(!bad.includes("<img") && !bad.includes("ecx-icon-box-icon") && !bad.includes("is-v-center") && !bad.includes("javascript:"), bad);
});

test("lời chứng thực: kiểu bong bóng, 4/5 sao có nhãn đọc màn hình, dấu trích; mặc định không sao, không dấu trích", async () => {
  const t = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "testimonial", attrs: { quote: "Tốt", name: "Lan", ...attrs } }] });
  const out = await html(t({ variant: "bubble", rating: 4, quoteMark: true }), ctx());
  assert.match(out, /<figure class="ecx-testimonial is-bubble[^"]*"/, out);
  assert.ok(out.includes('<span role="img" aria-label="4/5" class="ecx-testimonial-rating">'), out);
  assert.equal(out.match(/class="is-on"/g)?.length, 4, out);
  assert.equal(out.match(/class="is-off"/g)?.length, 1, out);
  assert.ok(out.includes('<span aria-hidden="true" class="ecx-testimonial-mark">“</span>'), out);
  const plain = await html(t({}), ctx());
  assert.ok(!plain.includes("ecx-testimonial-rating") && !plain.includes("ecx-testimonial-mark") && /class="ecx-testimonial[ "]/.test(plain) && !plain.includes("is-bubble"), plain);
});

test("bộ đếm: số chữ thập phân tự đặt, tiêu đề là h3; thanh tiến độ: giá trị lẻ 1 chữ thập phân, kiểu chạy đều, tắt hiệu ứng, nhãn đọc màn hình riêng", async () => {
  const out = await html({ type: "doc", content: [
    { type: "counter", attrs: { end: 12.5, decimals: 2, titleTag: "h3", title: "Năm" } },
    { type: "progressBar", attrs: { label: "A", value: 72.25, decimals: 1, easing: "linear", animate: false, ariaLabel: "Tiến độ A" } },
    { type: "progressBar", attrs: { label: "B", value: 40 } }] }, ctx());
  assert.ok(out.includes('data-decimals="2"') && out.includes(">12.50<") && /<h3 class="ecx-counter-title">/.test(out), out);
  assert.ok(out.includes(">72.3%<") && out.includes('aria-label="Tiến độ A"') && out.includes('aria-valuenow="72.3"') && out.includes("--ecx-progress-ease:linear"), out);
  assert.match(out, /class="ecx-progress"[^>]*>.*class="ecx-progress ecx-in"/s, out);
  assert.ok(out.includes(">40%<") && out.includes('aria-label="B"'), out);
});

test("accordion: mở sẵn mục đầu; nhóm một-mục không mở hơn một; chọn tất cả khi cho mở nhiều; mục tự đặt open thì giữ nguyên", async () => {
  const pane = (t: string, extra: Record<string, unknown> = {}) => ({ type: "details", attrs: { summary: t, ...extra }, content: [{ type: "paragraph", content: [{ type: "text", text: t.toLowerCase() }] }] });
  const acc = (attrs: Record<string, unknown>, panes: unknown[]) => ({ type: "doc", content: [{ type: "accordion", attrs, content: panes }] });
  const opens = (out: string) => (out.match(/<details[^>]*>/g) ?? []).map((t) => t.includes(" open"));
  assert.deepEqual(opens(await html(acc({}, [pane("A"), pane("B")]), ctx())), [false, false]);
  assert.deepEqual(opens(await html(acc({ startOpen: "first" }, [pane("A"), pane("B")]), ctx())), [true, false]);
  assert.deepEqual(opens(await html(acc({ startOpen: "all" }, [pane("A"), pane("B")]), ctx())), [true, false]);
  assert.deepEqual(opens(await html(acc({ startOpen: "all", multiple: true }, [pane("A"), pane("B")]), ctx())), [true, true]);
  assert.deepEqual(opens(await html(acc({ startOpen: "first" }, [pane("A"), pane("B", { open: true })]), ctx())), [false, true]);
});

test("tab: icon ở trên + chỉ hiện icon → class của khối; không đặt thì class như cũ; icon sai vị trí bị bỏ", async () => {
  const tabs = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "tabs", attrs, content: [{ type: "tab", attrs: { title: "A", icon: "star" }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] }] });
  const out = await html(tabs({ iconPosition: "top", iconOnly: true, orientation: "vertical" }), ctx());
  assert.match(out, /class="ecx-tabs is-vertical has-icon-top is-icon-only"/, out);
  assert.ok(out.includes('class="ecx-tab-label"') && out.includes(">A<"), out); // chữ vẫn có trong HTML (trình đọc màn hình)
  assert.match(await html(tabs({}), ctx()), /class="ecx-tabs"/);
  const right = await html(tabs({ iconPosition: "right" }), ctx());
  assert.ok(/class="ecx-tabs has-icon-right"/.test(right) && !right.includes("is-icon-only"), right);
  assert.match(await html(tabs({ iconPosition: "bottom" }), ctx()), /class="ecx-tabs"/);
});

test("mục lục: ẩn tiêu đề thì chỉ còn danh sách; thu gọn được thì tiêu đề vẫn hiện (là nút mở / đóng)", async () => {
  const doc = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "tableOfContents", attrs }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Giới thiệu" }] }] });
  const shown = await html(doc({ title: "Nội dung" }), ctx());
  assert.ok(shown.includes('class="ecx-toc-title"') && shown.includes("Giới thiệu"), shown);
  const hidden = await html(doc({ title: "Nội dung", showTitle: false }), ctx());
  assert.ok(!hidden.includes("ecx-toc-title") && hidden.includes("ecx-toc-list") && hidden.includes('aria-label="Nội dung"'), hidden);
  const folded = await html(doc({ title: "Nội dung", showTitle: false, collapsible: true }), ctx());
  assert.ok(folded.includes('<summary class="ecx-toc-title">Nội dung</summary>'), folded);
});

test("tìm kiếm: phần Ô nhập / Nút và màu chữ gợi ý ra CSS trên website như khung soạn; giá trị màu lạ bị bỏ", async () => {
  const dynamic: RenderContext["dynamic"] = async (node, key) => <div key={key} className="ecx-search"><form className="search-form"><input type="search" /><button type="submit">Tìm</button></form></div>;
  const attrs = { buttonStyle: "icon", searchPlaceholderColor: "#5d6a75", searchMaxWidth: { base: "24rem" },
    parts: { input: { style: { color: { text: "#0f1e29" } }, hover: { color: { background: "#f3f4f6" } } }, button: { style: { color: { background: "#1a597b" } } } } };
  const out = await html({ type: "doc", content: [{ type: "search", attrs }] }, ctx({ dynamic }));
  assert.ok(out.includes('input[type="search"]') && out.includes("color:#0f1e29") && out.includes("input::placeholder{color: #5d6a75}") && out.includes("max-width: 24rem"), out);
  assert.ok(out.includes("button[type=&quot;submit&quot;]") || out.includes('button[type="submit"]'), out);
  const bad = await html({ type: "doc", content: [{ type: "search", attrs: { searchPlaceholderColor: "red;}body{display:none" } }] }, ctx({ dynamic }));
  assert.ok(!bad.includes("display:none") && !bad.includes("::placeholder"), bad);
});

test("thư viện ảnh: masonry theo cột, ảnh giữ tỉ lệ; link riêng của ảnh thắng link ảnh gốc; link nguy hiểm thì bỏ; mặc định vẫn lưới 8px", async () => {
  const g = (attrs: Record<string, unknown>, images: unknown[]) => ({ type: "doc", content: [{ type: "gallery", attrs: { images, ...attrs } }] });
  const img = (extra: Record<string, unknown>) => ({ src: "/u/a.jpg", alt: "A", full: "/u/a-lon.jpg", ...extra });
  const m = await html(g({ layout: "masonry", columns: 3 }, [img({ href: "/san-pham/a" })]), ctx());
  assert.match(m, /class="ecx-gallery cms-gallery is-masonry ecx-gallery-columns-3 columns-3"/, m);
  assert.ok(m.includes("column-count:3") && m.includes("column-gap:var(--ecx-gallery-gap, 8px)") && !m.includes("display:grid"), m);
  assert.ok(m.includes('href="/san-pham/a"') && !m.includes("a-lon.jpg") && !m.includes("aspect-ratio"), m);
  const bad = await html(g({}, [img({ href: "javascript:alert(1)" })]), ctx());
  assert.ok(!bad.includes("javascript:") && bad.includes('href="/u/a-lon.jpg"') && bad.includes("display:grid") && bad.includes("gap:var(--ecx-gallery-gap, 8px)"), bad);
});

test("form: cỡ ô nhập lớn thêm class is-size-lg (một lần), cỡ vừa giữ class cũ; giá trị lạ bị bỏ", async () => {
  const form = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "form", attrs: { formId: "f_abc123", ...attrs }, content: [{ type: "formField", attrs: { kind: "text", name: "name", label: "Họ tên" } }] }] });
  configureRuntime({ themes: {}, plugins: {} });
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: [], activeTheme: null }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const c = ctx({ source: "post:12" });
    assert.match(await html(form({ inputSize: "lg" }), c), /<form class="ecx-form-blocks is-size-lg" novalidate="" data-form="f_abc123">/i);
    assert.match(await html(form({ inputSize: "sm" }), c), /<form class="ecx-form-blocks is-size-sm"/);
    assert.match(await html(form({}), c), /<form class="ecx-form-blocks" novalidate=""/i);
    assert.match(await html(form({ inputSize: "huge" }), c), /<form class="ecx-form-blocks" novalidate=""/i);
  } finally { globalThis.fetch = origFetch; }
});

test("bản đồ: khung Google Maps lazy, có title; địa chỉ rỗng thì không có khung", async () => {
  const doc = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "map", attrs }] });
  const out = await html(doc({ address: "1 Phạm Văn Đồng, Hà Nội", zoom: 16, height: 420, title: "Văn phòng" }), ctx());
  assert.ok(out.includes('<div class="ecx-map"><iframe') && out.includes("https://www.google.com/maps?q=1%20Ph") && out.includes('title="Văn phòng"') && out.includes('loading="lazy"') && out.includes("height:420px"), out);
  assert.equal(await html(doc({ address: "" }), ctx()), "");
});

test("nhóm: độ rộng nội dung tự nhập thành biến --ecx-group-width + class constrained; preset hoặc số trần thì bỏ", async () => {
  const g = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "group", attrs, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] });
  const out = await html(g({ contentWidth: "900px", align: "full" }), ctx());
  assert.ok(out.includes("--ecx-group-width:900px") && out.includes("ecx-is-constrained"), out);
  const bad = await html(g({ contentWidth: "900" }), ctx());
  assert.ok(!bad.includes("--ecx-group-width") && !bad.includes("ecx-is-constrained"), bad);
  const site = await html(g({ constrained: true }), ctx());
  assert.ok(site.includes("ecx-is-constrained") && !site.includes("--ecx-group-width"), site);
});

test("lớp phủ nền: chuyển màu + hoà trộn ra CSS ::before trên website; blend lạ bị bỏ", async () => {
  const g = (bg: Record<string, unknown>) => ({ type: "doc", content: [{ type: "group", attrs: { style: { background: bg } }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] });
  const out = await html(g({ image: { base: "/uploads/a.jpg" }, overlayGradient: "linear-gradient(180deg, #0f1e29 0%, #1a597b 100%)", overlayBlend: "multiply", overlayOpacity: 60 }), ctx());
  assert.ok(out.includes("::before{content:") && out.includes("mix-blend-mode:multiply") && out.includes("opacity:0.6") && out.includes("background-image:linear-gradient(180deg, #0f1e29 0%, #1a597b 100%)"), out);
  const bad = await html(g({ overlay: "#000", overlayBlend: "burn" }), ctx());
  assert.ok(bad.includes("::before{content:") && !bad.includes("mix-blend-mode"), bad);
});

test("đường chia: website ra CSS ::after có mặt nạ + z-index -1; hình lạ bị bỏ", async () => {
  const g = (divider: Record<string, unknown>) => ({ type: "doc", content: [{ type: "group", attrs: { style: { divider } }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] });
  const out = await html(g({ top: { shape: "wave", color: "primary", height: 120 }, bottom: { shape: "zigzag", color: "white" } }), ctx());
  assert.ok(out.includes("::after{content:") && out.includes("mask-image:url(") && out.includes("background-size:100% 120px,100% 80px") && out.includes("z-index:-1"), out);
  const bad = await html(g({ top: { shape: "star", color: "primary" } }), ctx());
  assert.ok(!bad.includes("mask-image"), bad);
});

test("bóng chữ tự chỉnh + chữ dọc: website ra text-shadow / writing-mode; giá trị ngoài khoảng bị bỏ", async () => {
  const p = (style: Record<string, unknown>) => ({ type: "doc", content: [{ type: "paragraph", attrs: { style }, content: [{ type: "text", text: "a" }] }] });
  const out = await html(p({ textShadow: { x: 2, y: 4, blur: 8, color: "black/40" }, writingMode: "vertical" }), ctx());
  assert.ok(out.includes("text-shadow:2px 4px 8px") && out.includes("writing-mode:vertical-rl"), out);
  const bad = await html(p({ textShadow: { x: 99, y: 4, blur: 8, color: "black" } }), ctx());
  assert.ok(!bad.includes("text-shadow"), bad);
});

test("icon cạnh chữ: tiêu đề / đoạn ra class + biến mặt nạ + title; mục lục dùng tocTitle", async () => {
  const doc = { type: "doc", content: [
    { type: "tableOfContents", attrs: {} },
    { type: "heading", attrs: { level: 2, icon: "star", iconPosition: "right", iconTitle: "Nổi bật", tocTitle: "Mục nổi bật" }, content: [{ type: "text", text: "Tiêu đề dài" }] },
    { type: "paragraph", attrs: { icon: "rocket" }, content: [{ type: "text", text: "Đoạn" }] }] };
  const out = await html(doc, ctx());
  assert.match(out, /<h2[^>]*class="ecx-has-icon ecx-icon-right"[^>]*title="Nổi bật"/);
  assert.ok(out.includes("--ecx-text-icon:url(") || out.includes("--ecx-text-icon: url("), out);
  assert.ok(out.includes("Mục nổi bật"), out);
  assert.ok(!/<p[^>]*ecx-has-icon/.test(out), out);
});
