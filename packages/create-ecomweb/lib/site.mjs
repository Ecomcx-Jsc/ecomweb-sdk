// `create-ecomweb dev --data <url>`: website chạy ngay trên máy bạn (Node, không Docker) với theme đang viết,
// đọc dữ liệu thật của site qua API công khai. Không ghi gì lên site; đẩy lên bằng `push`.
//   1. website (app/frontend của bản CMS cùng phiên bản với site) tải từ Store, kiểm chữ ký → cache ~/.cache/ecomweb/website/<phiên bản>
//   2. npm install một lần (+ gói npm theme khai báo trong package.json)
//   3. theme chép vào extensions/themes/<slug> và đồng bộ khi sửa file (registry chỉ thấy thư mục thật, không thấy symlink)
//   4. next dev
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { excluded, ignoreMatcher } from "./pack.mjs";
import { websiteFromStore } from "./store-cms.mjs";
import { c, readJson } from "./util.mjs";

// react / next đã có trong website; @ecomcx/ecomweb-* là SDK có sẵn — giống bộ lọc của Builder
const BUILTIN_DEP = (n) => n === "react" || n === "react-dom" || n === "next" || n.startsWith("@cms/") || n.startsWith("@ecomcx/ecomweb-");
const nodeBin = (fe, pkg) => path.join(fe, "node_modules", pkg, "dist", "bin", pkg);

export const cacheDir = () => process.env.ECOMWEB_CACHE_DIR ?? path.join(os.homedir(), ".cache", "ecomweb");

/** Gói npm theme khai báo mà website chưa có: { tên: phiên bản }. Phiên bản phải cụ thể (như khi cài lên site). */
export function extraDeps(themeDir, frontendDir) {
  const out = {};
  for (const [name, ver] of Object.entries(readJson(path.join(themeDir, "package.json"))?.dependencies ?? {}))
    if (!BUILTIN_DEP(name) && !fs.existsSync(path.join(frontendDir, "node_modules", name, "package.json"))) out[name] = ver;
  return out;
}

function sh(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 2).join(" ")} lỗi (${r.status})`);
}

/** Chép theme vào extensions/themes/<slug> (bỏ node_modules, dist… và .ecomwebignore). */
function copyTheme(src, dest, ignored) {
  fs.rmSync(dest, { recursive: true, force: true });
  const walk = (s, d) => {
    fs.mkdirSync(d, { recursive: true });
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const rel = path.relative(src, path.join(s, e.name)).split(path.sep).join("/");
      if (excluded(e.name) || ignored(rel, e.isDirectory())) continue;
      if (e.isDirectory()) walk(path.join(s, e.name), path.join(d, e.name));
      else if (e.isFile()) fs.copyFileSync(path.join(s, e.name), path.join(d, e.name));
    }
  };
  walk(src, dest);
}

async function siteVersion(url) {
  const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) throw new Error(`Không gọi được ${url}/api/health — kiểm tra địa chỉ site`);
  return (await r.json()).version;
}

export async function devData(dir, { url, port = 3000, source, storeUrl, publicKey }) {
  const manifest = readJson(path.join(dir, "theme.json"));
  if (!manifest?.slug) throw new Error("Không thấy theme.json — chạy trong thư mục theme (đã `clone` hoặc `theme \"Tên\"`)");
  url = url.replace(/\/$/, "");
  const log = (m) => console.log(c.dim(m));

  let frontendDir;
  if (source) {
    // Mã website có sẵn (vd thư mục frontend/ của repo CMS): chép sang cache để không ghi bậy vào nguồn
    frontendDir = path.join(cacheDir(), "website", "local", "frontend");
    if (!fs.existsSync(path.join(frontendDir, "package.json"))) {
      fs.mkdirSync(frontendDir, { recursive: true });
      fs.cpSync(path.resolve(source), frontendDir, { recursive: true, filter: (p) => !/[\\/](node_modules|\.next|generated|extensions)([\\/]|$)/.test(path.relative(source, p)) });
    }
  } else {
    const version = await siteVersion(url);
    log(`• Site ${url} chạy CMS ${version}`);
    ({ frontendDir } = await websiteFromStore(path.join(cacheDir(), "website"), { storeUrl, publicKey, version, log }));
  }

  if (!fs.existsSync(path.join(frontendDir, "node_modules", "next"))) {
    log("• Cài thư viện website (một lần, khoảng một phút)…");
    sh("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], frontendDir);
  }
  const deps = extraDeps(dir, frontendDir);
  if (Object.keys(deps).length) {
    log(`• Cài gói npm của theme: ${Object.entries(deps).map(([n, v]) => `${n}@${v}`).join(", ")}`);
    sh("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", ...Object.entries(deps).map(([n, v]) => `${n}@${v}`)], frontendDir);
  }

  const dest = path.join(frontendDir, "extensions", "themes", manifest.slug);
  const ignored = ignoreMatcher(dir);
  copyTheme(dir, dest, ignored);
  fs.writeFileSync(path.join(frontendDir, ".env.local"), `CMS_API_URL=${url}\n`);
  const regenerate = () => { try { sh("node", ["scripts/generate-registry.mjs"], frontendDir, { CMS_THEME: manifest.slug }); } catch (e) { console.log(c.red("✗ " + e.message)); } };
  regenerate();

  // Sửa file → chép lại đúng file đó; thêm / xoá file (template, locale…) → sinh lại registry để website nhận ngay
  let timer;
  fs.watch(dir, { recursive: true }, (_e, file) => {
    if (!file) return;
    const rel = file.split(path.sep).join("/");
    if (rel.split("/").some(excluded) || ignored(rel, false)) return;
    const from = path.join(dir, file), to = path.join(dest, file);
    const existed = fs.existsSync(to);
    if (fs.existsSync(from) && fs.statSync(from).isFile()) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); if (!existed) { clearTimeout(timer); timer = setTimeout(regenerate, 300); } }
    else if (!fs.existsSync(from) && existed) { fs.rmSync(to, { recursive: true, force: true }); clearTimeout(timer); timer = setTimeout(regenerate, 300); }
  });

  console.log(c.green(`✓ Website local: http://localhost:${port}`) + c.dim(`  (dữ liệu từ ${url}, chỉ đọc · Ctrl+C để dừng)`));
  // `next dev` dừng một lần để hiện nhắc nâng cấp (khi bản Next có lỗ hổng đã biết) rồi chạy tiếp ở lần sau: thoát sớm thì chạy lại một lần
  let child, retried = false;
  const start = () => {
    const t0 = Date.now();
    child = spawn("node", [nodeBin(frontendDir, "next"), "dev", "-p", String(port)], {
      cwd: frontendDir, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CMS_API_URL: url, CMS_THEME: manifest.slug },
    });
    child.on("exit", (code) => {
      if (!retried && Date.now() - t0 < 15_000) { retried = true; start(); return; }
      process.exit(code ?? 0);
    });
  };
  start();
  const stop = () => { retried = true; child.kill("SIGTERM"); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
