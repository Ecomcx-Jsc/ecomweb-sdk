import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirect } from "../src/auth-shared";

// safeRedirect chặn chuyển hướng ra trang ngoài sau khi đăng nhập (?redirect=…): trình duyệt chuẩn hoá URL trước khi mở,
// nên mọi giá trị được nhận phải vẫn cùng origin SAU khi phân tích bằng URL (như location.assign).
const ORIGIN = "https://site.vn";

test("safeRedirect giữ đường dẫn nội bộ", () => {
  for (const ok of ["/", "/account", "/tai-khoan?tab=orders#top", "/en/login", "/a//b"]) assert.equal(safeRedirect(ok), ok);
});

test("safeRedirect chặn mọi đích ra ngoài, kể cả dạng trình duyệt tự sửa thành //host", () => {
  const bad = [
    "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com",
    "/\\/evil.com", "/x\\..\\..\\/evil.com", "javascript:alert(1)", "evil.com", "", null, undefined, "/\u0000/evil.com",
  ];
  for (const b of bad) {
    const out = safeRedirect(b, "/home");
    assert.equal(out, "/home", `không được nhận: ${JSON.stringify(b)}`);
  }
});

test("mọi giá trị safeRedirect trả về đều cùng origin sau khi trình duyệt phân tích", () => {
  const samples = ["/ok", "/%2F%2Fevil.com", "/.//evil.com", "/\t/evil.com", "/\\evil.com", "//evil.com", "/@evil.com", "/:evil.com"];
  for (const s of samples) assert.equal(new URL(safeRedirect(s), ORIGIN).origin, ORIGIN, JSON.stringify(s));
});
