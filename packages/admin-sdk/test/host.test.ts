import assert from "node:assert/strict";
import { test } from "node:test";
import { can, createT, getSlots, navigate, registerFieldType, registerObjectMetaBox, t, useAdminRoute } from "../src/index";

// admin-sdk chỉ là lớp mỏng gọi host (globalThis.__CMS_ADMIN__): kiểm tra chuyển lời gọi đúng chỗ, và CMS cũ thiếu hàm thì không lỗi.

function withHost(h: Record<string, unknown>, run: () => void) {
  (globalThis as any).__CMS_ADMIN__ = h;
  try { run(); } finally { delete (globalThis as any).__CMS_ADMIN__; }
}

test("ngoài trang quản trị: báo lỗi rõ ràng", () => {
  assert.throws(() => can("x"), /trang quản trị/);
});

test("chuyển lời gọi tới host", () => {
  const calls: unknown[] = [];
  withHost({
    can: (c: string) => c === "manage_options",
    i18n: { locale: "vi", t: (k: string, v?: Record<string, unknown>) => `${k}|${JSON.stringify(v ?? {})}`, __: (s: string) => s, registerTranslations() {} },
    getSlots: (slot: string, pt?: string) => [{ slot, pt }],
    navigate: (to: string, o?: unknown) => calls.push(["navigate", to, o]),
    registerFieldType: (d: unknown) => calls.push(["field", d]),
    useAdminRoute: () => ({ path: "/orders/12", params: { id: "12" }, query: {}, navigate() {} }),
  }, () => {
    assert.equal(can("manage_options"), true);
    assert.equal(t("a.b", { n: 1 }), 'a.b|{"n":1}');
    assert.equal(createT("shop")("title"), "shop:title|{}");
    assert.equal(createT("shop")("core:x"), "core:x|{}");
    assert.deepEqual(getSlots("post.sidebar.end", "post"), [{ slot: "post.sidebar.end", pt: "post" }]);
    navigate("/orders", { replace: true });
    const def = { type: "shop/color", component: () => null };
    registerFieldType(def);
    assert.deepEqual(calls, [["navigate", "/orders", { replace: true }], ["field", def]]);
    assert.equal(useAdminRoute().params.id, "12");
  });
});

test("CMS cũ thiếu hàm mới: bỏ qua / trả giá trị mặc định, không lỗi", () => {
  withHost({ i18n: { locale: "vi", __: (s: string) => s, registerTranslations() {} } }, () => {
    assert.equal(t("a.b"), "a.b");
    assert.equal(registerFieldType({ type: "x/y", component: () => null }), undefined);
    assert.equal(registerObjectMetaBox({ id: "x", title: "X", object: "a/b", component: () => null } as any), undefined);
    const route = useAdminRoute();
    assert.deepEqual(route.params, {});
  });
});
