import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BlockProps, ShortcodeProps, Site } from "../src/types";
import { renderContent, type RenderContext } from "../src/rich";

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
