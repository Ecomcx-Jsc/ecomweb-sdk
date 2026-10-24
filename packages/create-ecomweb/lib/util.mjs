import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/^\n/, ""));
}

export function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function pascal(s) {
  return slugify(s).split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.quiet ? "pipe" : "inherit", ...opts });
    let out = "";
    child.stdout?.on("data", (d) => (out += d));
    child.stderr?.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} thoát với mã ${code}\n${out}`))));
  });
}

/** Backend dạng mã nguồn ("backend": "X.cs" / {"sources": [...]}) — CMS ≥ 1.7.0 tự biên dịch khi cài. Không phải → null. */
export function backendSources(manifest) {
  const b = manifest?.backend;
  if (typeof b === "string") return [b];
  if (b && Array.isArray(b.sources) && b.sources.length) return b.sources;
  if (b && typeof b.sources === "string") return [b.sources];
  return null;
}

// Mở rộng mẫu "a.cs", "src/*.cs" hoặc đệ quy (thư mục có "**") thành danh sách file tương đối, không ra ngoài thư mục.
export function expandSources(dir, patterns) {
  const out = new Set();
  const walk = (d, recursive, re) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (recursive && e.name !== "node_modules" && e.name !== "bin" && e.name !== "obj") walk(p, recursive, re); }
      else if (re.test(e.name)) out.add(path.relative(dir, p));
    }
  };
  for (const pat of patterns) {
    const rel = pat.replace(/\\/g, "/");
    if (!rel.includes("*")) { out.add(rel); continue; }
    const recursive = rel.includes("/**/");
    const base = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")).replace("/**", "") : "";
    const re = new RegExp("^" + path.basename(rel).replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    walk(path.join(dir, base), recursive, re);
  }
  return [...out].filter((f) => !f.startsWith("..") && !path.isAbsolute(f));
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

/** Tìm thư mục gốc monorepo CMS (có sdk/theme-sdk) để dev local; trả null nếu không có. */
export function findCmsRepo(start = process.cwd()) {
  if (process.env.CMS_REPO && fs.existsSync(path.join(process.env.CMS_REPO, "sdk"))) return path.resolve(process.env.CMS_REPO);
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "sdk", "theme-sdk", "package.json")) && fs.existsSync(path.join(dir, "backend"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
