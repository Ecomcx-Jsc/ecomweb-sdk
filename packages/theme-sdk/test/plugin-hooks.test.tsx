import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { controlsCss, defineBlockControls } from "@ecomcx/ecomweb-content";
import type { Site } from "../src/types";
import { renderContent, type RenderContext } from "../src/rich";

// Chỗ cắm cho plugin (core ≥ 1.29): ô điều khiển khai CSS, khối nhận ở trình duyệt, asset theo nhu cầu.
const site = { title: "T", tagline: "", url: "http://x", locale: "vi", timezone: "Asia/Ho_Chi_Minh", dateFormat: "", timeFormat: "", postsPerPage: 10, menus: {}, themeSettings: {} } as unknown as Site;
const ctx = (extra: Partial<RenderContext> = {}): RenderContext => ({ site, resolve: { shortcode: async () => null, block: async () => null }, ...extra });
const html = async (content: unknown, c: RenderContext) => renderToStaticMarkup(<>{await renderContent(content, c)}</>);
const doc = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "image", attrs: { src: "/uploads/a.jpg", ...attrs } }] });

const tilt = defineBlockControls({ id: "acme/tilt", blocks: ["image"], attributes: {
  acmeRotate: { type: "number", min: -45, max: 45, css: { "{{WRAPPER}}": "rotate: {{VALUE}}deg" } },
  acmeGlow: { type: "color", css: { "{{WRAPPER}} img": "filter: drop-shadow(0 4px 12px {{VALUE}})" } },
} });

test("ô điều khiển khai CSS: website in đúng class + CSS mà khung soạn tính (cùng hàm controlsCss)", async () => {
  const attrs = { acmeRotate: 10, acmeGlow: "#00ff00" };
  const out = await html(doc(attrs), ctx({ controls: [tilt] }));
  const expect = controlsCss([tilt], "image", attrs)!;
  assert.ok(out.includes(expect.css), out);
  assert.match(out, new RegExp(`class="[^"]*${expect.cls}`));
});

test("ô điều khiển: giá trị xấu không vào HTML", async () => {
  const out = await html(doc({ acmeRotate: 999, acmeGlow: "red;}body{display:none" }), ctx({ controls: [tilt] }));
  assert.ok(!out.includes("ecx-c-") && !out.includes("display:none"), out);
});

test("readyBlocks: chỉ gắn dấu khi plugin khai, chỉ các thuộc tính liệt kê", async () => {
  const plain = await html(doc({ acmeRotate: 5, alt: "x" }), ctx());
  assert.ok(!plain.includes("data-ecx-ready"));
  const marked = await html(doc({ acmeRotate: 5, alt: "x" }), ctx({ ready: { image: ["acmeRotate"] } }));
  assert.match(marked, /data-ecx-ready="image"/);
  assert.match(marked, /data-ecx-attrs="\{&quot;acmeRotate&quot;:5\}"/);
  // theme-sdk 1.41: khối không có giá trị nào trong danh sách → không gắn; danh sách rỗng → mọi khối loại đó
  for (const v of [undefined, null, "", []]) assert.ok(!(await html(doc({ acmeRotate: v }), ctx({ ready: { image: ["acmeRotate"] } }))).includes("data-ecx-ready"), String(v));
  assert.match(await html(doc({}), ctx({ ready: { image: [] } })), /data-ecx-ready="image" data-ecx-attrs="\{\}"/);
});

test("assets: chỉ in khi nội dung có khối / class khớp", async () => {
  const assets = [{ kind: "style" as const, src: "/extensions/acme/zoom.css", when: { blocks: ["image"] } }, { kind: "style" as const, src: "/extensions/acme/mx.css", when: { className: "mx-" } }];
  const out = await html(doc({}), ctx({ assets }));
  assert.ok(out.includes("zoom.css") && !out.includes("mx.css"), out);
  const none = await html({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }, ctx({ assets }));
  assert.ok(!none.includes(".css"), none);
});
