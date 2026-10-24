#!/usr/bin/env node
// create-nexus — tạo, kiểm tra, đóng gói và triển khai theme/plugin cho ECX Nexus.
//   create-nexus theme "Tên" [--parent default] [--blocks] [--dir x]
//   create-nexus plugin "Tên" [--admin] [--frontend] [--project] [--no-backend] [--tests] [--dir x]
//   create-nexus validate [thư-mục]
//   create-nexus upgrade [thư-mục]
//   create-nexus pack [thư-mục] [--out dist]
//   create-nexus deploy [thư-mục] [--url …] [--user …] [--password …] [--activate]
//   create-nexus dev [thư-mục] [--url …] [--user …] [--password …]   (tự đóng gói + cài lại khi sửa file)
//   create-nexus env up | status | down [--purge]
import { CLI } from "../lib/npm.mjs";
import fs from "node:fs";
import path from "node:path";
import { c, parseArgs } from "../lib/util.mjs";
import { scaffoldPlugin, scaffoldTheme } from "../lib/scaffold.mjs";
import { validate } from "../lib/validate.mjs";
import { upgrade } from "../lib/upgrade.mjs";
import { pack } from "../lib/pack.mjs";
import { check, deploy } from "../lib/deploy.mjs";
import { env, findEnv } from "../lib/env.mjs";

const HELP = `${c.bold("create-nexus")} — công cụ viết theme/plugin cho ECX Nexus

  ${c.cyan('theme "Tên"')} [--parent default]      tạo theme (child theme với --parent; --blocks: dựng bằng khối, sửa trong Trình dựng)
  ${c.cyan('plugin "Tên"')} [--admin] [--frontend] [--tests]   tạo plugin: plugin.json + một file C# (CMS tự biên dịch)
                                      --admin / --frontend: thêm giao diện React riêng · --project: dự án csproj · --no-backend
  ${c.cyan("validate")} [thư-mục]                  kiểm tra theme.json / plugin.json
  ${c.cyan("upgrade")} [thư-mục]                   đưa project theme/plugin lên SDK mới nhất (@ecomcx/nexus-theme-sdk, @ecomcx/nexus-admin-sdk) rồi kiểm tra lại
  ${c.cyan("test")} [thư-mục]                      đóng gói + chạy test xUnit trong tests/ trên CMS thử (Cms.Plugin.Testing)
  ${c.cyan("check")} [thư-mục]                     chạy thử trên CMS: manifest, biên dịch, quét bảo mật (như khi cài / nộp Store)
  ${c.cyan("pack")} [thư-mục] [--out dist]         đóng gói → dist/<slug>-<version>.zip
  ${c.cyan("deploy")} [thư-mục] [--activate]       đóng gói + cài lên CMS (--url, --user, --password)
  ${c.cyan("dev")} [thư-mục]                       tự đóng gói + cài lại mỗi khi sửa file
  ${c.cyan("env")} up [--dev] [--build DIR] | status | logs [api|builder] [-f] | down [--purge]
                                      CMS chạy bằng Docker để thử theme/plugin (--dev: sửa là thấy, không build lại)

Mặc định CMS ở http://localhost:5100 (hoặc môi trường của \`env up\`, biến CMS_URL / CMS_USER / CMS_PASSWORD).`;

const args = parseArgs(process.argv.slice(2));
const [cmd, ...rest] = args._;

/** Thông tin đăng nhập: tham số dòng lệnh → môi trường của `env up` (.cms-env) → biến môi trường (deploy tự đọc). */
function connection() {
  const saved = findEnv();
  return {
    url: args.url ?? (process.env.CMS_URL ? undefined : saved?.url),
    user: args.user ?? (process.env.CMS_USER ? undefined : saved?.user),
    password: args.password ?? (process.env.CMS_PASSWORD ? undefined : saved?.password),
    activate: !!args.activate,
  };
}

function report({ kind, errors, warnings }, dir) {
  warnings.forEach((w) => console.log(c.yellow("  ! " + w)));
  errors.forEach((e) => console.log(c.red("  ✗ " + e)));
  if (errors.length) return false;
  console.log(c.green(`✓ ${kind === "theme" ? "Theme" : "Plugin"} hợp lệ`) + c.dim(` (${path.relative(process.cwd(), dir) || "."})`));
  return true;
}

async function packAndReport(dir) {
  const r = await pack(dir, { out: args.out });
  console.log(c.green(`✓ ${path.relative(process.cwd(), r.zipPath)}`) + c.dim(` (${(r.size / 1024).toFixed(0)} KB)`));
  return r;
}

/** Theo dõi thay đổi (bỏ dist, node_modules, bin, obj) rồi đóng gói + cài lại; gộp các lần lưu liên tiếp. */
async function dev(dir) {
  const conn = connection();
  let running = false, again = false, timer;
  const cycle = async () => {
    if (running) { again = true; return; }
    running = true;
    try { await deploy(await packAndReport(dir), { ...conn, activate: true }); }
    catch (e) { console.log(c.red("✗ " + e.message)); }
    running = false;
    if (again) { again = false; cycle(); }
  };
  await cycle();
  // Môi trường `env up --dev` đã gắn thẳng thư mục này vào website: phần website (theme, frontend/ của plugin) tự nạp lại,
  // chỉ cài lại khi đổi phần cần máy chủ (backend, admin, plugin.json, locales)
  const mounted = (findEnv()?.dev && (findEnv().mounts ?? []).some((m) => path.resolve(m.dir) === path.resolve(dir)));
  const live = (file) => mounted && (fs.existsSync(path.join(dir, "theme.json")) || /^frontend[\\/]/.test(file));
  console.log(c.dim(`• Đang theo dõi thay đổi…${mounted ? " (website tự nạp lại, không cần build)" : ""} (Ctrl+C để dừng)`));
  const ignored = /(^|[\\/])(dist|node_modules|bin|obj|\.git|\.next)([\\/]|$)/;
  fs.watch(dir, { recursive: true }, (_e, file) => {
    if (!file || ignored.test(file)) return;
    if (live(file)) { console.log(c.dim(`• ${file} — website tự nạp lại`)); return; }
    clearTimeout(timer);
    timer = setTimeout(() => { console.log(c.cyan(`\n• ${file} thay đổi`)); cycle(); }, 400);
  });
}

try {
  const dir = path.resolve(rest[0] && !["theme", "plugin", "env"].includes(cmd) ? rest[0] : ".");
  switch (cmd) {
    case "theme":
    case "plugin": {
      const name = rest[0];
      if (!name) throw new Error(`Thiếu tên: create-nexus ${cmd} "Tên ${cmd}"`);
      const { root } = cmd === "theme"
        ? scaffoldTheme(name, { parent: args.parent, dir: args.dir, blocks: !!args.blocks })
        : scaffoldPlugin(name, { backend: args["no-backend"] ? false : args.project ? "project" : "source", admin: !!args.admin, frontend: !!args.frontend, tests: !!args.tests, dir: args.dir });
      console.log(c.green(`✓ Đã tạo ${cmd} ở ${path.relative(process.cwd(), root)}`));
      console.log(c.dim(`  cd ${path.relative(process.cwd(), root)} && npx ${CLI} dev`));
      break;
    }
    case "validate":
      if (!report(validate(dir), dir)) process.exit(1);
      break;
    case "upgrade":
      // Project tạo từ trước: lên SDK mới nhất rồi kiểm tra lại (validate báo API cũ / khai báo cần CMS mới hơn)
      await upgrade(dir);
      if (fs.existsSync(path.join(dir, "theme.json")) || fs.existsSync(path.join(dir, "plugin.json"))) report(validate(dir), dir);
      break;
    case "pack":
      await packAndReport(dir);
      break;
    case "deploy":
      await deploy(await packAndReport(dir), connection());
      break;
    case "test": {
      // Đóng gói → chạy dotnet test cho tests/*.csproj (Cms.Plugin.Testing cài gói lên CMS thử một lần rồi chạy test)
      const testsDir = path.join(dir, "tests");
      if (!fs.existsSync(testsDir) || !fs.readdirSync(testsDir).some((f) => f.endsWith(".csproj")))
        throw new Error("Không thấy tests/*.csproj — tạo bằng: create-nexus plugin \"Tên\" --tests (hoặc xem tài liệu Cms.Plugin.Testing)");
      const pkg = await packAndReport(dir);
      const conn = connection();
      const env = { ...process.env, CMS_TEST_PACKAGE: path.resolve(pkg.zipPath), CMS_TEST_SLUG: pkg.manifest.slug,
        ...(conn.url ? { CMS_URL: conn.url } : {}), ...(conn.user ? { CMS_USER: conn.user } : {}), ...(conn.password ? { CMS_PASSWORD: conn.password } : {}) };
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync("dotnet", ["test", testsDir, "--nologo"], { stdio: "inherit", env });
      if (r.status !== 0) process.exitCode = r.status ?? 1;
      break;
    }
    case "check":
      if (!(await check(await packAndReport(dir), connection()))) process.exitCode = 1;
      break;
    case "dev":
      await dev(dir);
      break;
    case "env":
      await env(rest[0], args);
      break;
    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      break;
    default:
      console.log(HELP);
      process.exit(1);
  }
} catch (e) {
  console.error(c.red("✗ " + (e?.message ?? e)));
  process.exit(1);
}
