// Test của các gói (packages/*/test/*.test.ts|tsx) — không cần thêm thư viện: esbuild (có sẵn) bundle rồi chạy bằng node --test.
//   node scripts/test.mjs            → mọi gói
//   node scripts/test.mjs content    → một gói
//   UPDATE_SNAPSHOTS=1 node scripts/test.mjs theme-sdk   → ghi lại ảnh chụp HTML (xem kỹ diff trước khi commit)
import { build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const only = process.argv[2];
// Trong node_modules của repo: import "react"… tìm được thư viện (ESM không dùng NODE_PATH)
mkdirSync(path.join(root, "node_modules", ".cache"), { recursive: true });
const out = mkdtempSync(path.join(root, "node_modules", ".cache", "cms-sdk-test-"));
const entries = [];
for (const pkg of readdirSync(path.join(root, "packages"))) {
  const dir = path.join(root, "packages", pkg, "test");
  if ((only && pkg !== only) || !existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => /\.test\.tsx?$/.test(f))) entries.push(path.join(dir, f));
}
try {
  await build({
    entryPoints: entries, bundle: true, platform: "node", format: "esm", outdir: out, outbase: path.join(root, "packages"),
    outExtension: { ".js": ".mjs" }, jsx: "automatic", logLevel: "warning", packages: "external",
    // Gói trong repo (packages/x) được bundle từ nguồn TS; @ecomcx/ecomweb-content và thư viện ngoài (react…) lấy từ node_modules
    plugins: [{ name: "workspace", setup(b) { b.onResolve({ filter: /^@cms\/[\w-]+$/ }, (a) => {
      const src = path.join(root, "packages", a.path.slice(5), "src", "index.ts");
      if (existsSync(src)) return { path: src };
      // Gói @cms ngoài repo (vd @ecomcx/ecomweb-content cài từ GitHub): tìm từ thư mục của file đang import, bundle luôn vào test
      try { return { path: createRequire(path.join(a.resolveDir, "x.js")).resolve(a.path) }; } catch { return undefined; }
    }); } }],
    define: {
      "process.env.SDK_ROOT": JSON.stringify(root),
      // Thư mục gói @ecomcx/ecomweb-content (fixture hợp đồng) theo đúng bản theme-sdk đang dùng
      "process.env.CMS_CONTENT_DIR": JSON.stringify(path.dirname(createRequire(path.join(root, "packages", "theme-sdk", "x.js")).resolve("@ecomcx/ecomweb-content/package.json"))),
    },
  });
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name)); };
  walk(out);
  execFileSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
} finally { rmSync(out, { recursive: true, force: true }); }
