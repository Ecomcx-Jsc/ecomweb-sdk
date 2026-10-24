import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ADMIN_SDK, OLD_NAMES, THEME_SDK, VERSION } from "./npm.mjs";
import { c, readJson, run } from "./util.mjs";

// Tên mới + tên cũ (project tạo trước khi SDK lên npm / trước Ecomweb: giữ khoá cũ làm bí danh để import cũ vẫn chạy)
const SDK = [THEME_SDK, ADMIN_SDK, "@cms/theme-sdk", "@cms/admin-sdk", "@ecomcx/nexus-theme-sdk", "@ecomcx/nexus-admin-sdk"];
/** Phiên bản mới nhất trên npm (dự phòng: phiên bản của CLI đang chạy). */
function latest(npmName) {
  try { return execFileSync("npm", ["view", npmName, "version"], { encoding: "utf8", shell: process.platform === "win32" }).trim(); }
  catch { return VERSION; }
}
const spec = (key) => (OLD_NAMES[key] ? `npm:${OLD_NAMES[key]}@^${latest(OLD_NAMES[key])}` : `^${latest(key)}`);

/**
 * Đưa project theme/plugin lên SDK mới nhất trên npm (@ecomcx/ecomweb-theme-sdk, @ecomcx/ecomweb-admin-sdk). Project cũ khai báo
 * "@cms/…" (cài bằng link tarball trên GitHub) → bí danh "npm:@ecomcx/ecomweb-…@^bản mới nhất" để import cũ vẫn chạy
 * (validate nhắc đổi import sang tên mới). Bỏ bản đang cài khỏi node_modules + package-lock.json rồi cài lại.
 * Website không phụ thuộc bản này: CMS build theme/plugin bằng SDK của chính nó; bản trong project dùng cho gợi ý code,
 * kiểm tra kiểu và `pack`.
 */
export async function upgrade(dir) {
  const pkgFile = path.join(dir, "package.json");
  const pkg = readJson(pkgFile);
  if (!pkg) throw new Error(`Không thấy package.json ở ${dir}`);
  const found = [];
  for (const section of ["dependencies", "devDependencies"])
    for (const name of SDK)
      if (pkg[section]?.[name] !== undefined) {
        const before = pkg[section][name];
        pkg[section][name] = spec(name);
        found.push({ name, before, installed: readJson(path.join(dir, "node_modules", ...name.split("/"), "package.json"))?.version ?? null });
      }
  if (!found.length) { console.log(c.dim("  Project không dùng @ecomcx/ecomweb-theme-sdk hay @ecomcx/ecomweb-admin-sdk — không có gì để nâng.")); return { upgraded: [] }; }
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

  // Gỡ bản cũ khỏi lockfile + node_modules: npm giữ bản theo lockfile/cache nếu link không đổi
  const lockFile = path.join(dir, "package-lock.json");
  const lock = readJson(lockFile);
  if (lock?.packages) {
    for (const { name } of found) {
      delete lock.packages[`node_modules/${name}`];
      if (lock.packages[""]?.dependencies?.[name]) lock.packages[""].dependencies[name] = pkg.dependencies[name];
      if (lock.packages[""]?.devDependencies?.[name]) lock.packages[""].devDependencies[name] = pkg.devDependencies[name];
    }
    fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n");
  }
  for (const { name } of found) fs.rmSync(path.join(dir, "node_modules", ...name.split("/")), { recursive: true, force: true });

  console.log(c.cyan("• Cài SDK mới nhất…"));
  await run("npm", ["install", "--prefer-online", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir, quiet: true, shell: process.platform === "win32" });
  const upgraded = found.map((f) => ({ ...f, now: readJson(path.join(dir, "node_modules", ...f.name.split("/"), "package.json"))?.version ?? null }));
  for (const u of upgraded) console.log(`  ${u.name.padEnd(16)} ${u.installed ?? "?"} → ${c.green(u.now ?? "?")}`);
  return { upgraded };
}
