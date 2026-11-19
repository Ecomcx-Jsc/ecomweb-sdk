import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import AdmZip from "adm-zip";
// @ts-expect-error
import { clone, pull, pushGuard } from "../lib/remote.mjs";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** CMS giả: một theme với tập file thay đổi được; chỉ nhận token "cmsp_ok". */
async function fakeCms() {
  const state = { version: "1.0.0", files: { "theme.json": "{}", "a.txt": "a", "b.txt": "b" } as Record<string, string> };
  const info = () => {
    const files = Object.fromEntries(Object.entries(state.files).map(([k, v]) => [k, sha(v)]));
    return { slug: "demo", version: state.version, hash: "sha256:" + sha(JSON.stringify(files)), files };
  };
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== "Bearer cmsp_ok") { res.statusCode = 401; return res.end(); }
    if (req.url === "/api/admin/themes/demo/package/info") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(info())); }
    if (req.url === "/api/admin/themes/demo/package") {
      const z = new AdmZip();
      for (const [k, v] of Object.entries(state.files)) z.addFile(k, Buffer.from(v));
      return res.end(z.toBuffer());
    }
    res.statusCode = 404; res.end();
  });
  await new Promise<void>((r) => server.listen(0, r));
  return { state, url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, close: () => server.close() };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "remote-"));
const read = (d: string, f: string) => fs.readFileSync(path.join(d, f), "utf8");
process.env.ECOMWEB_CONFIG_DIR = tmp();

test("clone → pull: không đổi, server đổi, bạn đã sửa file khác, cùng sửa một file", async () => {
  const cms = await fakeCms();
  const dir = path.join(tmp(), "demo");
  const opts = { url: cms.url, token: "cmsp_ok" };
  try {
    await clone("demo", { dir, ...opts });
    assert.equal(read(dir, "a.txt"), "a");
    assert.ok(fs.existsSync(path.join(dir, ".ecomweb", "remote.json")));

    await pull(dir, opts); // không đổi

    // server sửa a.txt, xoá b.txt, thêm c.txt; bạn sửa b.txt... (b bị xoá trên server → xung đột), d.txt là file mới của bạn
    cms.state.files["a.txt"] = "a2"; delete cms.state.files["b.txt"]; cms.state.files["c.txt"] = "c"; cms.state.version = "1.0.1";
    fs.writeFileSync(path.join(dir, "d.txt"), "mine");
    fs.writeFileSync(path.join(dir, "b.txt"), "b-mine");
    await assert.rejects(pull(dir, opts), /pull --force/);
    assert.equal(read(dir, "a.txt"), "a", "xung đột thì chưa ghi gì");

    fs.writeFileSync(path.join(dir, "b.txt"), "b"); // bỏ sửa → pull được
    await pull(dir, opts);
    assert.equal(read(dir, "a.txt"), "a2");
    assert.equal(read(dir, "c.txt"), "c");
    assert.ok(!fs.existsSync(path.join(dir, "b.txt")), "file server xoá thì xoá ở local");
    assert.equal(read(dir, "d.txt"), "mine", "file mới của bạn được giữ");

    // cùng sửa a.txt
    cms.state.files["a.txt"] = "a3";
    fs.writeFileSync(path.join(dir, "a.txt"), "a-local");
    await assert.rejects(pull(dir, opts), /pull --force/);
    await pull(dir, { ...opts, force: true });
    assert.equal(read(dir, "a.txt"), "a3");
  } finally { cms.close(); }
});

test("clone từ chối thư mục đã có file; token sai bị từ chối", async () => {
  const cms = await fakeCms();
  try {
    const dir = tmp(); fs.writeFileSync(path.join(dir, "x"), "1");
    await assert.rejects(clone("demo", { dir, url: cms.url, token: "cmsp_ok" }), /đã có file/);
    await assert.rejects(clone("demo", { dir: path.join(tmp(), "n"), url: cms.url, token: "cmsp_bad" }), /từ chối \(401\)/);
  } finally { cms.close(); }
});

test("push bị chặn khi server đã đổi, --force cho qua", async () => {
  const cms = await fakeCms();
  const dir = path.join(tmp(), "demo");
  const opts = { url: cms.url, token: "cmsp_ok" };
  try {
    await clone("demo", { dir, ...opts });
    const g = await pushGuard(dir, opts);
    assert.match(g.baseHash, /^sha256:/);
    cms.state.files["a.txt"] = "server";
    await assert.rejects(pushGuard(dir, opts), /pull/);
    assert.equal((await pushGuard(dir, { ...opts, force: true })).baseHash, undefined);
  } finally { cms.close(); }
});
