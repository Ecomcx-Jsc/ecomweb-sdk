import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { c, run, backendSources, expandSources } from "./util.mjs";
import { validate } from "./validate.mjs";

const EXCLUDE = new Set(["node_modules", ".git", "dist", ".DS_Store", "bin", "obj", ".next"]);
const cliDir = path.dirname(fileURLToPath(import.meta.url));

function copyFiltered(src, dest, filter = () => true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name) || !filter(path.join(src, e.name), e)) continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyFiltered(s, d, filter);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

/** Mã của @ecomcx/ecomweb-admin-sdk: trong repo CMS dùng src/*.ts; cài từ npm dùng dist/*.js (bản đã biên dịch). */
function adminSdkFiles() {
  const local = path.resolve(cliDir, "../../admin-sdk/src");
  if (fs.existsSync(path.join(local, "index.ts"))) return { dir: local, ext: ".ts" };
  return { dir: path.join(path.dirname(createRequire(import.meta.url).resolve("@ecomcx/ecomweb-admin-sdk/package.json")), "dist"), ext: ".js" };
}

/** esbuild plugin: import "./x.css" → chèn <style> khi bundle được nạp. */
const cssInject = {
  name: "css-inject",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => ({
      contents: `const s=document.createElement("style");s.textContent=${JSON.stringify(await fs.promises.readFile(args.path, "utf8"))};document.head.appendChild(s);`,
      loader: "js",
    }));
  },
};

/** name: "index" (trang quản trị) hoặc "login" (admin.loginEntry — nạp trên trang đăng nhập, vd ô captcha). */
export async function buildAdmin(dir, outFile, name = "index") {
  const entry = [".tsx", ".ts", ".jsx", ".js"].map((ext) => path.join(dir, "admin", "src", name + ext)).find(fs.existsSync);
  if (!entry) return false;
  const esbuild = await import("esbuild");
  const { dir: sdk, ext } = adminSdkFiles();
  await esbuild.build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    minify: true,
    sourcemap: false,
    legalComments: "none",
    plugins: [cssInject],
    alias: {
      react: path.join(sdk, "react" + ext),
      "react/jsx-runtime": path.join(sdk, "jsx-runtime" + ext),
      "react/jsx-dev-runtime": path.join(sdk, "jsx-runtime" + ext),
      "@ecomcx/ecomweb-admin-sdk": path.join(sdk, "index" + ext),
      // defineBlock (file khối dùng chung admin + website): dùng bản đi kèm CLI — plugin không cần cài gì thêm
      "@ecomcx/ecomweb-content": createRequire(import.meta.url).resolve("@ecomcx/ecomweb-content"),
      // Tên cũ (plugin viết trước khi SDK lên npm / trước khi đổi tên Ecomweb)
      "@cms/admin-sdk": path.join(sdk, "index" + ext),
      "@cms/content": createRequire(import.meta.url).resolve("@ecomcx/ecomweb-content"),
      "@ecomcx/nexus-admin-sdk": path.join(sdk, "index" + ext),
      "@ecomcx/nexus-content": createRequire(import.meta.url).resolve("@ecomcx/ecomweb-content"),
    },
    logLevel: "warning",
  });
  return true;
}

export async function pack(dir, { out } = {}) {
  dir = path.resolve(dir);
  const { kind, manifest, errors, warnings } = validate(dir);
  warnings.forEach((w) => console.log(c.yellow("  ! " + w)));
  if (errors.length) throw new Error("Gói không hợp lệ:\n" + errors.map((e) => "  - " + e).join("\n"));

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "cms-pack-"));
  const root = path.join(staging, manifest.slug);
  try {
    if (kind === "theme") {
      copyFiltered(dir, root);
    } else {
      fs.mkdirSync(root, { recursive: true });
      fs.copyFileSync(path.join(dir, "plugin.json"), path.join(root, "plugin.json"));
      for (const extra of ["README.md", "LICENSE", "screenshot.png"]) if (fs.existsSync(path.join(dir, extra))) fs.copyFileSync(path.join(dir, extra), path.join(root, extra));
      // Bản dịch theo khoá (locales/{mã}.json) — CMS nạp cho cả admin lẫn backend
      if (fs.existsSync(path.join(dir, "locales"))) copyFiltered(path.join(dir, "locales"), path.join(root, "locales"), (p) => p.endsWith(".json"));

      const sources = backendSources(manifest);
      if (sources) {
        // Mã nguồn C#: CMS tự biên dịch khi cài — chỉ chép file .cs
        for (const f of expandSources(dir, sources)) {
          fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
          fs.copyFileSync(path.join(dir, f), path.join(root, f));
        }
      } else if (manifest.backend) {
        const csproj = fs.existsSync(path.join(dir, "backend")) ? fs.readdirSync(path.join(dir, "backend")).find((f) => f.endsWith(".csproj")) : null;
        if (csproj) {
          console.log(c.cyan("  • Build backend (dotnet publish)…"));
          const pub = path.join(staging, "publish");
          await run("dotnet", ["publish", path.join(dir, "backend", csproj), "-c", "Release", "-o", pub, "--nologo", "-v", "q"], { quiet: true });
          fs.mkdirSync(path.join(root, "backend"), { recursive: true });
          for (const f of fs.readdirSync(pub)) {
            if (/^Cms\.Plugin\.Sdk\./.test(f) || f.endsWith(".pdb") && !process.env.CMS_PACK_PDB) continue;
            const s = path.join(pub, f);
            if (fs.statSync(s).isDirectory()) copyFiltered(s, path.join(root, "backend", f));
            else fs.copyFileSync(s, path.join(root, "backend", f));
          }
          if (!fs.existsSync(path.join(root, manifest.backend.assembly))) throw new Error(`Build xong nhưng không thấy ${manifest.backend.assembly}`);
        } else {
          copyFiltered(path.join(dir, "backend"), path.join(root, "backend"), (p) => !p.endsWith(".cs"));
        }
      }

      if (manifest.admin) {
        console.log(c.cyan("  • Bundle admin (esbuild)…"));
        const outFile = path.join(root, manifest.admin.entry);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        if (!(await buildAdmin(dir, outFile))) fs.copyFileSync(path.join(dir, manifest.admin.entry), outFile);
        if (manifest.admin.loginEntry) {
          const loginOut = path.join(root, manifest.admin.loginEntry);
          fs.mkdirSync(path.dirname(loginOut), { recursive: true });
          if (!(await buildAdmin(dir, loginOut, "login"))) fs.copyFileSync(path.join(dir, manifest.admin.loginEntry), loginOut);
        }
      }

      if (manifest.frontend) {
        const feDir = path.dirname(path.join(dir, manifest.frontend.entry));
        copyFiltered(feDir, path.join(root, path.relative(dir, feDir)));
      }
    }

    const outDir = path.resolve(out ?? path.join(dir, "dist"));
    fs.mkdirSync(outDir, { recursive: true });
    const zipPath = path.join(outDir, `${manifest.slug}-${manifest.version}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(root, manifest.slug);
    zip.writeZip(zipPath);
    return { kind, manifest, zipPath, size: fs.statSync(zipPath).size };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
