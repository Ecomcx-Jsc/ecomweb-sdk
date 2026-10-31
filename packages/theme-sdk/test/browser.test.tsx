import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emit, on, pluginClient, PluginApiError, TranslationsProvider, useT } from "../src/browser";

// Phần chạy trên trình duyệt (core ≥ 1.20.0): gọi endpoint plugin, sự kiện giữa theme / plugin, dịch chữ trong component client.

test("pluginClient gọi qua proxy của website, gửi JSON và trả JSON", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, count: 2 }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const shop = pluginClient("shop");
  const data = await shop.post<{ count: number }>("/cart/items", { productId: 5 }, { query: { coupon: "ABC", empty: undefined } });
  assert.equal(data.count, 2);
  assert.equal(calls[0].url, "/api/cms/plugins/shop/cart/items?coupon=ABC");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body, JSON.stringify({ productId: 5 }));
  assert.equal(calls[0].init.credentials, "same-origin");
  await shop.get("cart");
  assert.equal(calls[1].url, "/api/cms/plugins/shop/cart");
  assert.equal(calls[1].init.body, undefined);
});

test("pluginClient ném PluginApiError kèm lỗi theo trường", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ title: "Dữ liệu không hợp lệ", errors: { qty: ["Phải lớn hơn 0"] }, code: "shop.qty" }), { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(pluginClient("shop").put("/cart/items/1", { qty: 0 }), (e: unknown) => {
    assert.ok(e instanceof PluginApiError);
    assert.equal(e.status, 422);
    assert.equal(e.message, "Dữ liệu không hợp lệ");
    assert.deepEqual(e.errors, { qty: ["Phải lớn hơn 0"] });
    assert.equal(e.code, "shop.qty");
    return true;
  });
  assert.throws(() => pluginClient("../admin"));
});

test("emit / on: theme nghe sự kiện plugin phát, huỷ được", () => {
  (globalThis as { window?: unknown }).window = new EventTarget();
  try {
    const seen: unknown[] = [];
    const off = on("shop.cart.changed", (d) => seen.push(d));
    emit("shop.cart.changed", { count: 3 });
    off();
    emit("shop.cart.changed", { count: 4 });
    assert.deepEqual(seen, [{ count: 3 }]);
  } finally { delete (globalThis as { window?: unknown }).window; }
});

test("useT dịch theo chuỗi server gửi xuống (ICU), provider lồng nhau gộp lại", () => {
  function Cart() {
    const t = useT();
    return <p>{t("cart.items", { count: 2 })} · {t("cart.title")} · {t("cart.missing")} · {t.locale}</p>;
  }
  const html = renderToStaticMarkup(
    <TranslationsProvider value={{ locale: "vi", messages: { "cart.title": { code: "vi", text: "Giỏ" } } }}>
      <TranslationsProvider value={{ locale: "vi", messages: { "cart.items": { code: "en", text: "{count, plural, one {# item} other {# items}}" } } }}>
        <Cart />
      </TranslationsProvider>
    </TranslationsProvider>,
  );
  assert.equal(html, "<p>2 items · Giỏ · cart.missing · vi</p>");
});
