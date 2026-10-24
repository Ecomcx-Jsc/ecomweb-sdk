import fs from "node:fs";
import { c } from "./util.mjs";

/** Đăng nhập CMS và upload gói zip (dùng cho `cms deploy` / `cms dev`). */
export async function deploy({ zipPath, kind, manifest }, { url, user, password, activate }) {
  const base = (url ?? process.env.CMS_URL ?? "http://localhost:5100").replace(/\/$/, "");
  user ??= process.env.CMS_USER ?? "admin";
  password ??= process.env.CMS_PASSWORD;
  if (!password) throw new Error("Thiếu mật khẩu: dùng --password hoặc biến môi trường CMS_PASSWORD");

  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: user, password }) });
  if (!login.ok) throw new Error(`Đăng nhập thất bại (${login.status})`);
  const { accessToken } = await login.json();
  const auth = { authorization: `Bearer ${accessToken}` };

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }), zipPath.split("/").pop());
  const res = await fetch(`${base}/api/admin/${kind === "theme" ? "themes" : "plugins"}/upload`, { method: "POST", headers: auth, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = body.errors ? "\n" + Object.values(body.errors).flat().map((e) => "  - " + e).join("\n") : "";
    throw new Error(`${body.title ?? "Upload thất bại"} (${res.status})${details}`);
  }
  console.log(c.green(`  ✓ ${body.message}`));
  if (body.restartRequired) await waitHealthy(base);

  if (body.buildId) {
    process.stdout.write(c.dim(`  • Đang build #${body.buildId}`));
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      let b;
      try { b = await (await fetch(`${base}/api/admin/builds/${body.buildId}`, { headers: auth })).json(); }
      catch { process.stdout.write("?"); continue; } // CMS đang khởi động lại

      if (b.status === "succeeded") { console.log(c.green(" ✓ build thành công")); break; }
      if (b.status === "failed") { console.log(c.red(" ✗ build lỗi\n") + (b.log ?? "").split("\n").slice(-25).join("\n")); throw new Error("Build thất bại"); }
      process.stdout.write(".");
    }
  }

  if (kind === "plugin" && activate) {
    const r = await fetch(`${base}/api/admin/plugins/${manifest.slug}/activate`, { method: "POST", headers: auth });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.title ?? "Kích hoạt thất bại");
    console.log(c.green(`  ✓ ${b.message}`));
    if (b.restartRequired) await waitHealthy(base);
  }
  if (kind === "theme" && activate) {
    const r = await fetch(`${base}/api/admin/themes/${manifest.slug}/activate`, { method: "POST", headers: auth });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).title) ?? "Kích hoạt theme thất bại");
    console.log(c.green("  ✓ Đã kích hoạt theme"));
  }
}

async function waitHealthy(base) {
  process.stdout.write(c.dim("  • Chờ CMS khởi động lại"));
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok && (await r.json()).status === "ok") { console.log(c.green(" ✓")); return; }
    } catch { /* đang khởi động */ }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("CMS chưa khởi động lại sau 90 giây");
}

/**
 * Chạy thử quy trình cài trên CMS (manifest, biên dịch mã nguồn, quét bảo mật — giống hệt khi cài và khi nộp Store) mà không cài.
 * Trả true nếu gói cài được không cần xác nhận rủi ro.
 */
export async function check({ zipPath, kind }, { url, user, password }) {
  if (kind === "theme") throw new Error("check hiện dành cho plugin — theme: dùng validate + deploy");
  const base = (url ?? process.env.CMS_URL ?? "http://localhost:5100").replace(/\/$/, "");
  user ??= process.env.CMS_USER ?? "admin";
  password ??= process.env.CMS_PASSWORD;
  if (!password) throw new Error("Thiếu mật khẩu: dùng --password, CMS_PASSWORD hoặc `create-nexus env up`");
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: user, password }) });
  if (!login.ok) throw new Error(`Đăng nhập thất bại (${login.status})`);
  const { accessToken } = await login.json();
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }), zipPath.split("/").pop());
  const res = await fetch(`${base}/api/admin/plugins/check`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` }, body: form });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(r.title ?? `CMS trả ${res.status}`);
  for (const e of r.errors ?? []) console.log(c.red(`  ✗ ${e}`));
  for (const e of r.compileErrors ?? []) console.log(c.red(`  ✗ ${e}`));
  for (const w of r.compileWarnings ?? []) console.log(c.yellow(`  ! ${w}`));
  if (r.scan) {
    const tone = { safe: c.green, warning: c.yellow, dangerous: c.red, blocked: c.red }[r.scan.verdict] ?? ((s) => s);
    console.log(`  • Quét bảo mật: ${tone(r.scan.verdict)} (${r.scan.filesScanned} file)`);
    for (const f of r.scan.findings ?? []) console.log(`    ${f.severity === "critical" || f.severity === "high" ? c.red("✗") : c.yellow("!")} [${f.severity}] ${f.message}${f.file ? c.dim(` — ${f.file}`) : ""}`);
  }
  console.log(r.ok ? c.green(`✓ ${r.slug} ${r.version}: cài được, không cần xác nhận rủi ro`) : c.red(`✗ ${r.slug ?? ""}: chưa đạt — sửa các lỗi trên`));
  return r.ok;
}
