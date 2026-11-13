import { test } from "node:test";
import assert from "node:assert/strict";
import { decideConsent, parseConsent, serializeConsent, CONSENT_CATEGORIES } from "../src/consent";
import { isValidPreference } from "../src/preferences";

test("consent round-trips through the preference cookie", () => {
  assert.equal(parseConsent(undefined), undefined);
  assert.equal(parseConsent(""), undefined);
  assert.deepEqual(parseConsent(serializeConsent([])), []);
  assert.deepEqual(parseConsent(serializeConsent(["marketing", "statistics"])), ["statistics", "marketing"]);
  // Cookie bị sửa tay: bỏ nhóm lạ
  assert.deepEqual(parseConsent("statistics_evil"), ["statistics"]);
  // Mọi tổ hợp vẫn hợp lệ với cookie tuỳ chọn (≤ 64 ký tự, [A-Za-z0-9_-])
  assert.ok(isValidPreference("consent", serializeConsent([...CONSENT_CATEGORIES])));
});

test("visitor's choice wins, otherwise the banner plugin's default; functional always allowed", () => {
  assert.equal(decideConsent("functional", [], false), true);
  assert.equal(decideConsent("marketing", ["statistics"], true), false);
  assert.equal(decideConsent("statistics", ["statistics"], false), true);
  assert.equal(decideConsent("marketing", undefined, true), true); // không có plugin banner
  assert.equal(decideConsent("marketing", undefined, false), false); // banner optin, khách chưa chọn
});

test("hasConsent in the browser: cookie first, then the banner's <meta> default, no banner = allowed", async () => {
  const { hasConsent } = await import("../src/client");
  const g = globalThis as { document?: unknown };
  const page = (cookie: string, meta?: string) => {
    g.document = { cookie, querySelector: () => (meta ? { content: meta } : null) };
  };
  try {
    page(""); // không có plugin banner
    assert.equal(hasConsent("marketing"), true);
    page("", "optin"); // banner opt-in, khách chưa chọn
    assert.equal(hasConsent("marketing"), false);
    assert.equal(hasConsent("functional"), true);
    page("a=1; cms-pref-consent=statistics", "optin");
    assert.equal(hasConsent("statistics"), true);
    assert.equal(hasConsent("marketing"), false);
    page("cms-pref-consent=none", "optout"); // khách đã từ chối
    assert.equal(hasConsent("statistics"), false);
  } finally {
    delete g.document;
  }
});
