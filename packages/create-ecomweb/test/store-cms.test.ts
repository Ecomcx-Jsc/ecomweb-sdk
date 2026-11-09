import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import { verifyItem } from "../lib/store-cms.mjs";

// Bản phát hành Store ký giống Cms.Packaging.PackageSignature: ECDSA P-256, chữ ký IEEE P1363 trên chuỗi chuẩn
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
function item(version: string, payload: object) {
  const body = JSON.stringify(payload);
  const canonical = `cms-package-v1|core|ecomweb|${version}|${createHash("sha256").update(body).digest("hex")}`;
  return { version, payload: body, signature: sign("sha256", Buffer.from(canonical), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64") };
}
const payload = { kind: "core", version: "1.25.0", packages: { built: { url: "/api/core/releases/1.25.0/built", sha256: "a".repeat(64) } } };

test("nhận bản phát hành ký đúng khoá", () => {
  assert.equal(verifyItem(pem, item("1.25.0", payload))?.version, "1.25.0");
});

test("từ chối nội dung bị sửa, chữ ký của khoá khác, phiên bản không khớp", () => {
  const ok = item("1.25.0", payload);
  assert.equal(verifyItem(pem, { ...ok, payload: ok.payload.replace("a".repeat(64), "b".repeat(64)) }), null);
  const other = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.equal(verifyItem(other, ok), null);
  assert.equal(verifyItem(pem, item("1.26.0", payload)), null);
});
