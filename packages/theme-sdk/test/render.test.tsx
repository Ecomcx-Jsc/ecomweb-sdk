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
    const out = await html(f.input);
    const snap = path.join(snapshots, `${f.name}.html`);
    if (process.env.UPDATE_SNAPSHOTS || !existsSync(snap)) writeFileSync(snap, out + "\n");
    assert.equal(out + "\n", readFileSync(snap, "utf8"));
    // Vẽ đầu vào thô và bản đã chuẩn hoá cho cùng kết quả
    assert.equal(await html(f.expected), out);
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
  assert.match(one, /class="ecx-accordion"/);
  assert.equal((one.match(/name="ecx-acc-[^"]+"/g) ?? []).length, 2);
  assert.equal(new Set(one.match(/name="ecx-acc-[^"]+"/g)).size, 1);
  const many = await html({ type: "doc", content: [{ type: "accordion", attrs: { multiple: true }, content: [item("A")] }] });
  assert.doesNotMatch(many, /<details[^>]* name=/);
  const stars = await html({ type: "doc", content: [{ type: "rating", attrs: { value: 3.6, max: 5, label: "ok" } }] });
  assert.equal((stars.match(/is-on/g) ?? []).length, 4);
  assert.match(stars, /aria-label="3\.6\/5"/);
  const cd = await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "2999-01-01T00:00:00Z", label: "Sale" } }] });
  assert.match(cd, /ecx-countdown/);
  assert.match(cd, /Sale/);
  assert.equal(await html({ type: "doc", content: [{ type: "countdown", attrs: { target: "không phải ngày" } }] }), "");
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
