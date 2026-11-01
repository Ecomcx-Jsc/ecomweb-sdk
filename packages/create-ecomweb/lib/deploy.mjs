import fs from "node:fs";
import { c } from "./util.mjs";

/** Đăng nhập CMS và upload gói zip (dùng cho `cms deploy` / `cms dev`). */
export async function deploy({ zipPath, kind, manifest }, { url, user, password, activate, acceptPermissions = false, acceptRisk = false }) {
  const base = (url ?? process.env.CMS_URL ?? "http://localhost:5100").replace(/\/$/, "");
  user ??= process.env.CMS_USER ?? "admin";
  password ??= process.env.CMS_PASSWORD;
  if (!password) throw new Error("Thiếu mật khẩu: dùng --password hoặc biến môi trường CMS_PASSWORD");

  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: user, password }) });
  if (!login.ok) throw new Error(`Đăng nhập thất bại (${login.status})`);
  const { accessToken } = await login.json();
  const auth = { authorization: `Bearer ${accessToken}` };

  // CMS hỏi lại khi gói xin quyền mới (409) hoặc bộ quét thấy hành vi rủi ro cao (422, canOverride): quản trị viên phải đồng ý.
  // Trên máy dev của chính bạn: --accept-permissions / --accept-risk để đồng ý thay (giống bấm "Đồng ý" trong trang Plugin).
  const query = new URLSearchParams();
  if (acceptPermissions) query.set("acceptPermissions", manifest.slug);
  if (acceptRisk) query.set("acceptRisk", "true");
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }), zipPath.split("/").pop());
  const res = await fetch(`${base}/api/admin/${kind === "theme" ? "themes" : "plugins"}/upload${query.size ? `?${query}` : ""}`, { method: "POST", headers: auth, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = body.errors ? "\n" + Object.values(body.errors).flat().map((e) => "  - " + e).join("\n") : "";
    const asked = body.data?.permissionsRequired;
    if (res.status === 409 && asked)
      throw new Error(`${body.title} (409)\n  Quyền xin thêm: ${asked.added.join(", ")} — đồng ý: chạy lại với --accept-permissions`);
    if (res.status === 422 && body.canOverride) {
      const findings = (body.scan?.findings ?? []).filter((f) => f.severity !== "info").map((f) => `  - [${f.severity}] ${f.message} (${f.file ?? ""})`).join("\n");
      throw new Error(`${body.title} (422)\n${findings}\n  Tin nguồn gốc gói: chạy lại với --accept-risk`);
    }
    throw new Error(`${body.title ?? "Upload thất bại"} (${res.status})${details}`);
  }
  console.log(c.green(`  ✓ ${body.message}`));
  if (body.restartRequired) await waitHealthy(base);

  if (body.buildId) await waitBuild(base, auth, body.buildId);

  if (kind === "plugin" && activate) {
    const r = await fetch(`${base}/api/admin/plugins/${manifest.slug}/activate`, { method: "POST", headers: auth });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.title ?? "Kích hoạt thất bại");
    console.log(c.green(`  ✓ ${b.message}`));
    if (b.restartRequired) await waitHealthy(base);
    // Plugin có phần website: được bật khi website build xong — chờ để báo đúng kết quả
    if (b.buildId) await waitBuild(base, auth, b.buildId);
  }
  if (kind === "theme" && activate) {
    const r = await fetch(`${base}/api/admin/themes/${manifest.slug}/activate`, { method: "POST", headers: auth });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.title ?? "Kích hoạt theme thất bại");
    // Bật theme = build website với theme mới; website chỉ chuyển theme khi build xong (lỗi → giữ theme cũ)
    if (b.buildId) await waitBuild(base, auth, b.buildId);
    console.log(c.green("  ✓ Đã kích hoạt theme"));
  }
}

/** Chờ một lượt build của website; lỗi → in 25 dòng cuối của log và ném lỗi (website vẫn chạy bản trước). */
async function waitBuild(base, auth, id) {
  process.stdout.write(c.dim(`  • Đang build #${id}`));
  for (let i = 0; i < 900; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    let b;
    try { b = await (await fetch(`${base}/api/admin/builds/${id}`, { headers: auth })).json(); }
    catch { process.stdout.write("?"); continue; } // CMS đang khởi động lại
    if (b.status === "succeeded") { console.log(c.green(" ✓ build thành công")); return; }
    if (b.status === "failed") { console.log(c.red(" ✗ build lỗi\n") + (b.log ?? "").split("\n").slice(-25).join("\n")); throw new Error("Build thất bại — website vẫn chạy bản trước"); }
    process.stdout.write(".");
  }
  throw new Error(`Build #${id} chưa xong sau 15 phút — xem Giao diện › Lịch sử build`);
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
  if (!password) throw new Error("Thiếu mật khẩu: dùng --password, CMS_PASSWORD hoặc `create-ecomweb env up`");
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
