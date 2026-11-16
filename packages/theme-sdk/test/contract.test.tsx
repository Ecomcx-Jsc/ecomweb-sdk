import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsApiError, getComments, getMenu, getPattern, getTerms } from "../src/api";
import { requireUser, getCurrentUser, userCan } from "../src/auth";
import { Menu, PostDate, WidgetArea } from "../src/components";
import { applyFilters, configureRuntime, definePlugin, doAction, getPlugin, hasPlugin } from "../src/runtime";
import type { Post } from "../src/types";

// Hợp đồng của SDK 2.0: cách báo lỗi (null khi 404, ném khi lỗi khác, phần phụ tự ẩn), đăng nhập, runtime plugin, API đã cũ.

const SITE = {
  title: "T", tagline: "", url: "http://x", locale: "vi", defaultLocale: "vi", languages: [{ code: "vi", name: "Tiếng Việt", isDefault: true }],
  timezone: "Asia/Ho_Chi_Minh", dateFormat: "yyyy-MM-dd", postsPerPage: 10, showOnFront: "posts", activeTheme: "t", themeSettings: {},
  activePlugins: ["shop", "broken"], menuLocations: {}, extra: {},
};
let route: (url: URL) => Response = () => new Response("{}");
const calls: URL[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  calls.push(url);
  if (url.pathname.endsWith("/site")) return json(SITE);
  return route(url);
}) as typeof fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const html = async (el: Promise<unknown> | unknown) => renderToStaticMarkup((await el) as never);
const quiet = async <T,>(fn: () => Promise<T>) => {
  const err = console.error, warn = console.warn; const logs: unknown[][] = [];
  console.error = (...a) => logs.push(a); console.warn = (...a) => logs.push(a);
  try { return { value: await fn(), logs }; } finally { console.error = err; console.warn = warn; }
};

test("hàm lấy một mục: 404 → null; lỗi khác → ném CmsApiError", async () => {
  route = () => json({}, 404);
  assert.equal(await getMenu("primary", "vi"), null);
  assert.equal(await getPattern(1), null);
  route = () => json({}, 500);
  await assert.rejects(getMenu("primary", "vi"), (e: unknown) => e instanceof CmsApiError && e.status === 500);
  await assert.rejects(getPattern(2), (e: unknown) => e instanceof CmsApiError && e.status === 500);
});

test("phần phụ (Menu, WidgetArea) gặp CMS lỗi: ghi log, vẽ fallback / không vẽ — trang không sập", async () => {
  route = () => json({}, 500);
  const menu = await quiet(() => html(Menu({ location: "footer", fallback: <span>dự phòng</span> })));
  assert.equal(menu.value, "<span>dự phòng</span>");
  assert.ok(menu.logs.some((l) => String(l[0]).includes("menu \"footer\"")));
  const area = await quiet(async () => await WidgetArea({ id: "sidebar" }));
  assert.equal(area.value, null);
});

test("PostDate không truyền site → tự đọc định dạng ngày + múi giờ của website", async () => {
  const post = { publishedAt: "2026-11-15T23:30:00Z", createdAt: "2026-11-15T23:30:00Z" } as Post;
  assert.equal(await html(PostDate({ post })), '<time dateTime="2026-11-15T23:30:00Z">2026-11-16</time>');
  assert.equal(await html(PostDate({ post, site: { dateFormat: "dd/MM/yyyy", timezone: "UTC" } })), '<time dateTime="2026-11-15T23:30:00Z">15/11/2026</time>');
});

test("getTerms / getComments: dạng object và dạng cũ gửi cùng request; dạng cũ cảnh báo một lần", async () => {
  route = () => json([]);
  await getTerms({ taxonomy: "category", hideEmpty: false, locale: "vi" });
  const a = calls[calls.length - 1]!;
  const old = await quiet(async () => { await getTerms("category", false, "vi"); await getTerms("category", false, "vi"); });
  const b = calls[calls.length - 1]!;
  assert.equal(b.href, a.href);
  assert.equal(a.pathname, "/api/public/terms/category");
  assert.equal(a.searchParams.get("hideEmpty"), "false");
  assert.equal(old.logs.filter((l) => String(l[0]).includes("getTerms(taxonomy")).length, 1, "cảnh báo đúng một lần");

  route = () => json({ items: [], total: 0, count: 0, page: 2, totalPages: 2 });
  await getComments(7, { page: 2, perPage: 5, order: "asc" });
  const c = calls[calls.length - 1]!;
  await quiet(() => getComments(7, 2, undefined, { perPage: 5, order: "asc" }));
  assert.equal(calls[calls.length - 1]!.href, c.href);
  assert.equal(c.searchParams.get("page"), "2");
  assert.equal(c.searchParams.get("perPage"), "5");
});

test("đăng nhập: ngoài request là khách; userCan; requireUser chuyển tới /login kèm redirect", async () => {
  assert.equal(await getCurrentUser(), null);
  const user = { id: 1, displayName: "A", capabilities: ["read", "edit_posts"] } as never;
  assert.equal(userCan(user, "edit_posts"), true);
  assert.equal(userCan(user, "manage_options"), false);
  assert.equal(userCan(null, "read"), false);
  await assert.rejects(requireUser("/account?tab=1"), (e: unknown) => {
    const digest = String((e as { digest?: string }).digest ?? "");
    return digest.startsWith("NEXT_REDIRECT") && digest.includes("/login?redirect=%2Faccount%3Ftab%3D1");
  });
});

test("runtime plugin: getPlugin / hasPlugin theo plugin đang bật; filter, action chạy theo thứ tự, lỗi của một plugin bị cô lập", async () => {
  const seen: string[] = [];
  configureRuntime({
    themes: { t: { manifest: { slug: "t" }, templates: {}, extend: async () => ({ default: definePlugin({ filters: { "x.title": (v: string) => `${v}|theme` } }) }) } } as never,
    plugins: {
      shop: async () => ({ default: definePlugin({ exports: { price: (n: number) => `${n}đ` }, filters: { "x.title": (v: string) => `${v}|shop` }, actions: { "x.done": (a: string) => { seen.push(`shop:${a}`); } } } as never) }),
      broken: async () => ({ default: definePlugin({ filters: { "x.title": () => { throw new Error("hỏng"); } }, actions: { "x.done": () => { throw new Error("hỏng"); } } } as never) }),
      off: async () => ({ default: definePlugin({ exports: { a: 1 } }) }),
    },
  });
  const shop = await getPlugin<{ price(n: number): string }>("shop");
  assert.equal(shop?.price(5), "5đ");
  assert.equal(await getPlugin("off"), null, "plugin chưa bật → null");
  assert.equal(await hasPlugin("shop"), true);
  assert.equal(await hasPlugin("off"), false);
  const r = await quiet(() => applyFilters("x.title", "A"));
  assert.equal(r.value, "A|shop|theme", "plugin trước, theme sau; filter lỗi bị bỏ qua");
  assert.ok(r.logs.some((l) => String(l[0]).includes("filter x.title")));
  await quiet(() => doAction("x.done", "ok"));
  assert.deepEqual(seen, ["shop:ok"]);
});
