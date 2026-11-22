import assert from "node:assert/strict";
import { test } from "node:test";
import { configureRuntime, findShortcode } from "../src/runtime";

test("shortcode của theme (extend) thắng shortcode cùng tên của plugin; không trùng thì dùng của plugin", async () => {
  const origFetch = globalThis.fetch;
  const site = { title: "T", language: "vi", locale: "vi", url: "https://e.com", activePlugins: ["shop"], activeTheme: "th" };
  globalThis.fetch = (async () => new Response(JSON.stringify(site), { headers: { "content-type": "application/json" } })) as typeof fetch;
  const fromPlugin = () => null, fromTheme = () => null, onlyPlugin = () => null;
  try {
    configureRuntime({
      themes: { th: { manifest: { slug: "th" }, templates: {}, extend: async () => ({ default: { shortcodes: { cart: fromTheme } } }) } } as never,
      plugins: { shop: async () => ({ default: { shortcodes: { cart: fromPlugin, checkout: onlyPlugin } } }) } as never,
    });
    assert.equal(await findShortcode("cart", site as never), fromTheme);
    assert.equal(await findShortcode("checkout", site as never), onlyPlugin);
  } finally { globalThis.fetch = origFetch; }
});
