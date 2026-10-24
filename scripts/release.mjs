#!/usr/bin/env node
// Đóng gói @ecomcx/nexus-admin-sdk, @ecomcx/nexus-theme-sdk (JavaScript đã biên dịch + .d.ts) + CLI @ecomcx/create-nexus
// thành tarball: publish lên npm (workflow publish.yml / scripts/npm-publish.mjs) và đính kèm GitHub Release.
// Core và plugin cài bằng URL cố định phiên bản (npm không cài được thư mục con của repo git):
//   "@ecomcx/nexus-theme-sdk": "^1.24.0"   (bản cũ: link tarball trên GitHub Release)
//
//   node scripts/release.mjs            → build + đóng gói vào dist-release/
//   node scripts/release.mjs --check    → như trên + cài thử vào dự án trống, kiểm tra import / .d.ts / "use client"
// CLI create-cms không cần tarball: chạy thẳng từ repo (npx github:Ecomcx-Jsc/ecx-nexus-sdk#<tag> …).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "dist-release");
const check = process.argv.includes("--check");
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString();
const PACKAGES = ["packages/admin-sdk", "packages/theme-sdk", "packages/create-cms"];
// Gói của mình (phụ thuộc GitHub / workspace → phiên bản trên npm khi đóng gói)
const OWN = new Set(["@ecomcx/nexus-theme-sdk", "@ecomcx/nexus-admin-sdk", "@ecomcx/nexus-content", "@ecomcx/create-nexus"]);
// Tên file đính kèm GitHub Release (giữ như cũ cho các nơi còn cài bằng link)
const ASSET = { "@ecomcx/nexus-theme-sdk": "cms-theme-sdk", "@ecomcx/nexus-admin-sdk": "cms-admin-sdk", "@ecomcx/create-nexus": "create-cms" };

/** "./api" → "./api.js", "./x" (thư mục) → "./x/index.js": Node ESM và webpack (gói type: module) bắt buộc đuôi đầy đủ. */
function fixSpecifiers(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) { fixSpecifiers(file); continue; }
    if (!/\.(js|d\.ts)$/.test(name)) continue;
    const src = readFileSync(file, "utf8");
    const fixed = src.replace(/((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']+?)(["'])/g, (m, a, spec, z) => {
      if (/\.(js|css|json)$/.test(spec)) return m;
      const base = path.resolve(path.dirname(file), spec);
      return a + (existsSync(base) && statSync(base).isDirectory() ? `${spec}/index.js` : `${spec}.js`) + z;
    });
    if (fixed !== src) writeFileSync(file, fixed);
  }
}

/** Phụ thuộc giữa các gói của mình → phiên bản trên npm (GitHub / workspace không cài được từ npm). */
function npmDeps(deps, version) {
  if (!deps) return deps;
  const out = {};
  for (const [name, spec] of Object.entries(deps)) {
    const semver = /#semver:(\^?[\d.]+)$/.exec(spec)?.[1];
    out[name] = !OWN.has(name) ? spec
      : spec.startsWith("file:") ? version
      : semver ? (semver.split(".").length === 2 ? semver + ".0" : semver) : spec;
  }
  return out;
}

const publishMeta = (pkg, dir) => ({
  repository: { type: "git", url: "git+https://github.com/Ecomcx-Jsc/ecx-nexus-sdk.git", directory: dir },
  homepage: "https://github.com/Ecomcx-Jsc/ecx-nexus-sdk#readme",
  license: pkg.license ?? "MIT",
  publishConfig: { access: "public", provenance: true },
  dependencies: npmDeps(pkg.dependencies, pkg.version),
});

/** CLI: chạy thẳng mã nguồn .mjs, chỉ đổi tên + phụ thuộc. */
function cliManifest(pkg, dir) {
  const { scripts, devDependencies, ...rest } = pkg;
  return { ...rest, ...publishMeta(pkg, dir) };
}

/** package.json bản phát hành: trỏ vào dist/, bỏ script nội bộ. */
function releaseManifest(pkg, dir) {
  const toDist = (p) => p.replace(/^\.\/src\//, "./dist/").replace(/\.tsx?$/, ".js");
  const exportsMap = {};
  for (const [k, v] of Object.entries(pkg.exports ?? { ".": pkg.main })) {
    if (typeof v !== "string") continue;
    exportsMap[k] = { types: toDist(v).replace(/\.js$/, ".d.ts"), import: toDist(v), default: toDist(v) };
  }
  exportsMap["./package.json"] = "./package.json";
  const { scripts, devDependencies, ...rest } = pkg;
  const files = ["dist", "README.md", ...(pkg.files ?? []).filter((f) => f !== "src" && f !== "README.md")];
  return { ...rest, ...publishMeta(pkg, dir), main: toDist(pkg.main), types: toDist(pkg.main).replace(/\.js$/, ".d.ts"), exports: exportsMap, files, sideEffects: false };
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const tarballs = [];
const versions = new Set();

for (const dir of PACKAGES) {
  const pkg = JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8"));
  versions.add(pkg.version);
  const stage = path.join(out, "stage", pkg.name.replace("/", "__"));
  if (!pkg.main) {
    // CLI: không biên dịch
    for (const f of pkg.files ?? []) if (existsSync(path.join(root, dir, f))) cpSync(path.join(root, dir, f), path.join(stage, f), { recursive: true });
    writeFileSync(path.join(stage, "package.json"), JSON.stringify(cliManifest(pkg, dir), null, 2) + "\n");
    tarballs.push({ name: pkg.name, file: path.join(out, run("npm", ["pack", "--silent", "--pack-destination", out], stage).trim().split("\n").pop()) });
    continue;
  }
  // Biên dịch trong node_modules của repo (thư viện phụ thuộc + kiểu của chúng đã được hoist ở đó)
  const work = path.join(root, "node_modules", ".cms-release", path.basename(dir));
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(path.join(root, dir, "src"), path.join(work, "src"), { recursive: true });
  writeFileSync(path.join(work, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], module: "esnext", moduleResolution: "bundler", jsx: "react-jsx",
      strict: true, skipLibCheck: true, isolatedModules: true, declaration: true, outDir: path.join(stage, "dist"), rootDir: "src",
    },
    include: ["src"],
  }));
  run(path.join(root, "node_modules", ".bin", "tsc"), ["-p", work], work);
  rmSync(work, { recursive: true, force: true });
  fixSpecifiers(path.join(stage, "dist"));
  for (const extra of (pkg.files ?? []).filter((f) => f !== "src" && f !== "README.md"))
    if (existsSync(path.join(root, dir, extra))) cpSync(path.join(root, dir, extra), path.join(stage, extra), { recursive: true });
  if (existsSync(path.join(root, dir, "README.md"))) cpSync(path.join(root, dir, "README.md"), path.join(stage, "README.md"));
  writeFileSync(path.join(stage, "package.json"), JSON.stringify(releaseManifest(pkg, dir), null, 2) + "\n");
  tarballs.push({ name: pkg.name, file: path.join(out, run("npm", ["pack", "--silent", "--pack-destination", out], stage).trim().split("\n").pop()) });
}
rmSync(path.join(out, "stage"), { recursive: true, force: true });
if (versions.size !== 1) throw new Error(`Các gói phải cùng phiên bản (đang có ${[...versions].join(", ")})`);
const version = [...versions][0];

// npm pack đặt tên theo gói npm (ecomcx-nexus-theme-sdk-x.y.z.tgz) → tên file đính kèm GitHub Release như cũ
// + bản không số phiên bản để URL /releases/latest/download/cms-theme-sdk.tgz luôn cố định. npm-publish.json: thứ tự publish.
const npmList = [];
for (const t of tarballs) {
  const asset = path.join(out, `${ASSET[t.name]}-${version}.tgz`);
  cpSync(t.file, asset);
  cpSync(t.file, path.join(out, `${ASSET[t.name]}.tgz`));
  rmSync(t.file);
  npmList.push({ name: t.name, file: path.basename(asset) });
}
writeFileSync(path.join(out, "npm-publish.json"), JSON.stringify(npmList, null, 2) + "\n");

if (check) {
  const tmp = path.join(out, "check");
  mkdirSync(tmp, { recursive: true });
  writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "check", private: true, type: "module" }));
  // Cài như theme/plugin cài: tarball vừa đóng; @ecomcx/nexus-content lấy từ npm (phải publish trước)
  run("npm", ["install", "--no-audit", "--no-fund", "--silent", "--legacy-peer-deps",
    ...npmList.filter((x) => x.name !== "@ecomcx/create-nexus").map((x) => path.join(out, x.file)), "react@19.2.0", "react-dom@19.2.0"], tmp);
  writeFileSync(path.join(tmp, "check.mjs"), `
    const admin = await import("@ecomcx/nexus-admin-sdk");
    if (typeof admin.registerPage !== "function") throw new Error("@ecomcx/nexus-admin-sdk thiếu export");
    console.log("  ✓ @ecomcx/nexus-admin-sdk import được (Node ESM)");
    const content = await import("@ecomcx/nexus-content");
    if (content.normalizeContent({ type: "doc", content: [] }).doc.version !== 1) throw new Error("@ecomcx/nexus-content sai");
    console.log("  ✓ @ecomcx/nexus-content (phụ thuộc của theme-sdk, cài từ npm) import được");
  `);
  console.log(run("node", ["check.mjs"], tmp).trim());
  for (const f of ["@ecomcx/nexus-admin-sdk/dist/index.d.ts", "@ecomcx/nexus-theme-sdk/dist/index.d.ts", "@ecomcx/nexus-theme-sdk/dist/client.js", "@ecomcx/nexus-content/dist/index.js"])
    if (!existsSync(path.join(tmp, "node_modules", f))) throw new Error(`Thiếu ${f}`);
  const client = readFileSync(path.join(tmp, "node_modules/@ecomcx/nexus-theme-sdk/dist/client.js"), "utf8");
  if (!client.startsWith('"use client"')) throw new Error('theme-sdk/client.js mất chỉ thị "use client"');
  console.log('  ✓ Có .d.ts, "use client" giữ nguyên');
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Đã đóng gói v${version} trong dist-release/:`);
for (const f of readdirSync(out)) console.log("  " + f);
console.log(`\nPhát hành: gh release create v${version} dist-release/*.tgz --title "SDK v${version}" (workflow tự publish lên npm)`);
console.log(`Cài: npm i @ecomcx/nexus-theme-sdk@^${version}`);
