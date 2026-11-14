import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { configureRuntime } from "../src/runtime";
import Landing from "../src/page-landing";
import FullWidth from "../src/page-full-width";

const doc = (...content: unknown[]) => ({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content } }] });
// Template có component con bất đồng bộ (PostContent) → vẽ bằng prerender (chờ hết async), không dùng renderToStaticMarkup
const render = async (el: ReactNode) => new Response((await prerender(<>{el}</>)).prelude).text();
const text = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });

test("template landing / full-width có sẵn: theme khối vẫn có header / footer (template part), theme thường thì layout lo", async () => {
  const origFetch = globalThis.fetch;
  const site = { title: "Test", language: "vi", locale: "vi", url: "https://example.com", activePlugins: [], activeTheme: "blk" };
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(
    /\/templates\b/.test(String(u)) ? { theme: "blk", templates: {}, parts: { header: doc(text("HEAD")), footer: doc(text("FOOT")) } }
      : /\/site\b/.test(String(u)) ? site : { items: [], total: 0 }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const post = { id: 1, title: "Tiêu đề", content: doc(text("BODY")) };
    const props = { data: { kind: "single", post } as never, site: site as never, settings: {}, template: "landing" };
    configureRuntime({ themes: { blk: { manifest: { slug: "blk", editing: "blocks" }, templates: {} } } as never, plugins: {} });
    const out = await render(await Landing(props));
    assert.match(out, /^<header class="ecx-template-part ecx-template-part-header">.*HEAD.*<\/header><div class="ecx-full-width ecx-landing">.*BODY.*<\/div><footer class="ecx-template-part ecx-template-part-footer">.*FOOT.*<\/footer>$/);
    assert.doesNotMatch(out, /Tiêu đề/);
    const fw = await render(await FullWidth({ ...props, template: "full-width" }));
    assert.match(fw, /^<header[^>]*>.*HEAD.*<h1 class="entry-title ecx-page-title">Tiêu đề<\/h1>.*BODY.*<footer[^>]*>.*FOOT/);
    // Theme thường: header / footer nằm trong layout của theme → template không vẽ thêm
    configureRuntime({ themes: { blk: { manifest: { slug: "blk" }, templates: {} } } as never, plugins: {} });
    const plain = await render(await Landing(props));
    assert.match(plain, /^<div class="ecx-full-width ecx-landing">/);
    assert.doesNotMatch(plain, /HEAD|FOOT/);
  } finally { globalThis.fetch = origFetch; }
});
