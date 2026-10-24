import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { readJson, backendSources, expandSources } from "./util.mjs";
import { OLD_NAMES } from "./npm.mjs";

const SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
const FIELD_TYPES = ["text", "textarea", "number", "checkbox", "select", "color", "media", "url", "email", "richtext", "menu"];

/** Kiểm tra theme hoặc plugin. Trả về { kind, manifest, errors, warnings }. */
export function validate(dir) {
  const errors = [];
  const warnings = [];
  const themeJson = path.join(dir, "theme.json");
  const pluginJson = path.join(dir, "plugin.json");
  const kind = fs.existsSync(themeJson) ? "theme" : fs.existsSync(pluginJson) ? "plugin" : null;
  if (!kind) return { kind: null, manifest: null, errors: ["Không tìm thấy theme.json hoặc plugin.json"], warnings };
  const manifest = readJson(kind === "theme" ? themeJson : pluginJson);
  if (!manifest) return { kind, manifest: null, errors: [`${kind}.json không phải JSON hợp lệ`], warnings };

  if (!manifest.name) errors.push("Thiếu name");
  if (!SLUG.test(manifest.slug ?? "")) errors.push("slug chỉ gồm a-z, 0-9, dấu gạch ngang (2–64 ký tự)");
  if (!SEMVER.test(manifest.version ?? "")) errors.push("version phải theo semver, vd 1.0.0");
  const dicts = checkLocales(dir, errors, warnings);
  checkLabelKeys(manifest, dicts, kind, errors, warnings);
  checkOldImports(dir, warnings);
  // Bản dịch kiểu cũ (khoá là chuỗi gốc): { "en": { "Chuỗi gốc": "Translation" } } — vẫn chạy, nên chuyển sang locales/*.json
  if (manifest.translations !== undefined) {
    warnings.push(kind === "plugin"
      ? '"translations" (khoá là chuỗi gốc) đã cũ — chuyển sang locales/{vi,en}.json + createT()/Text.T(); nhãn trong plugin.json viết "%khoá%" (xem plugin-guide › Đa ngôn ngữ)'
      : '"translations" (khoá là chuỗi gốc) đã cũ — nhãn trong theme.json viết "%khoá%" và dịch trong locales/{vi,en}.json (CMS ≥ 1.8.0, xem theme-guide › Đa ngôn ngữ)');
    const t = manifest.translations;
    const okShape = t && typeof t === "object" && !Array.isArray(t) && Object.entries(t).every(([code, d]) =>
      /^[a-z]{2}(-[a-z0-9]{2,8})?$/i.test(code) && d && typeof d === "object" && !Array.isArray(d) && Object.values(d).every((v) => typeof v === "string"));
    if (!okShape) errors.push('translations phải có dạng { "en": { "Chuỗi gốc": "Bản dịch" } }');
  }
  if (!manifest.requires?.cms) warnings.push('Nên khai báo requires.cms, vd ">=1.0.0 <2.0.0"');
  checkPermissions(manifest.permissions, errors, warnings);

  if (kind === "theme") {
    const templates = path.join(dir, "templates");
    const hasIndex = ["index.tsx", "index.ts", ...(manifest.editing === "blocks" ? ["index.json"] : [])].some((f) => fs.existsSync(path.join(templates, f)));
    if (!manifest.parent && !hasIndex)
      errors.push(manifest.editing === "blocks" ? "Theme cần templates/index.json hoặc index.tsx (template dự phòng cuối cùng)" : "Theme cần templates/index.tsx (template dự phòng cuối cùng)");
    if (manifest.editing != null && !["code", "hybrid", "blocks"].includes(manifest.editing)) errors.push(`editing "${manifest.editing}" không hợp lệ (code, hybrid, blocks)`);
    for (const name of Object.keys(manifest.regions ?? {}))
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) errors.push(`regions: tên vùng "${name}" không hợp lệ (chữ thường, số, dấu gạch ngang)`);
    if (manifest.regions && manifest.editing !== "hybrid") warnings.push('regions chỉ được dùng khi theme.json có "editing": "hybrid"');
    // Vùng chuẩn của core: header/footer bọc trong EditableRegion thì plugin thay được với mọi theme
    const layoutFile = ["layout.tsx", "layout.ts"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
    if (layoutFile && manifest.editing !== "blocks") {
      const src = fs.readFileSync(layoutFile, "utf8");
      for (const name of ["header", "footer"])
        if (!new RegExp(`<EditableRegion[^>]*name=["']${name}["']`).test(src))
          warnings.push(`${path.basename(layoutFile)}: nên bọc ${name} trong <EditableRegion name="${name}" data={data}> để plugin thay được ${name}`);
    }
    for (const folder of ["templates", "parts"]) {
      const d = path.join(dir, folder);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d).filter((f) => f.endsWith(".json"))) {
        if (!/^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(f)) errors.push(`${folder}/${f}: tên file chỉ gồm chữ thường, số, gạch ngang`);
        try { const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); if (!Array.isArray(j.blocks) && j.type !== "doc") errors.push(`${folder}/${f}: không phải nội dung khối ({ version, blocks })`); }
        catch (e) { errors.push(`${folder}/${f}: JSON lỗi — ${e.message}`); }
      }
      if (manifest.editing !== "blocks" && folder === "templates" && fs.readdirSync(d).some((f) => f.endsWith(".json")))
        warnings.push('templates/*.json chỉ được dùng khi theme.json có "editing": "blocks"');
    }
    for (const f of manifest.settings ?? []) {
      if (!f.key) errors.push("settings: thiếu key");
      if (!FIELD_TYPES.includes(f.type)) errors.push(`settings.${f.key}: type "${f.type}" không hợp lệ (${FIELD_TYPES.join(", ")})`);
      if (f.type === "select" && !f.options?.length) errors.push(`settings.${f.key}: select cần options`);
    }
    const pageSlugs = new Set();
    for (const p of manifest.pages ?? []) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug ?? "")) errors.push(`pages: slug "${p.slug}" không hợp lệ (chữ thường, số, gạch ngang)`);
      else if (pageSlugs.has(p.slug)) errors.push(`pages: slug "${p.slug}" bị khai báo hai lần`);
      pageSlugs.add(p.slug);
      if (!p.title?.trim()) errors.push(`pages: trang "${p.slug}" thiếu title`);
      if (p.template != null && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.template)) errors.push(`pages: template "${p.template}" của trang "${p.slug}" không hợp lệ`);
      else if (p.template && !["canvas", "full-width"].includes(p.template) && !fs.existsSync(path.join(templates, `${p.template}.tsx`)) && !fs.existsSync(path.join(templates, `${p.template}.ts`)))
        warnings.push(`pages: trang "${p.slug}" dùng template "${p.template}" nhưng không thấy templates/${p.template}.tsx`);
    }
    const patternsDir = path.join(dir, "patterns");
    if (fs.existsSync(patternsDir)) for (const f of fs.readdirSync(patternsDir).filter((f) => f.endsWith(".json"))) {
      if (!/^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(f)) { errors.push(`patterns/${f}: tên file chỉ gồm chữ thường, số, gạch ngang`); continue; }
      try {
        const j = JSON.parse(fs.readFileSync(path.join(patternsDir, f), "utf8"));
        if (!j.title?.trim?.()) errors.push(`patterns/${f}: thiếu title`);
        if (!j.content || (typeof j.content !== "object")) errors.push(`patterns/${f}: thiếu content (cây khối)`);
        if (j.category && !/^[a-z][a-z0-9-]{0,30}$/.test(j.category)) errors.push(`patterns/${f}: category "${j.category}" không hợp lệ`);
      } catch (e) { errors.push(`patterns/${f}: JSON lỗi — ${e.message}`); }
    }
    if (manifest.screenshot && !fs.existsSync(path.join(dir, manifest.screenshot))) warnings.push(`Không thấy ảnh ${manifest.screenshot}`);
    if (fs.existsSync(path.join(dir, "node_modules"))) warnings.push("node_modules sẽ bị loại khỏi gói");
  } else {
    const declared = ["collections", "settings", "postTypes", "taxonomies", "postStatuses", "postMeta", "capabilities", "menus"].some((k) => manifest[k] && Object.keys(manifest[k]).length);
    for (const key of Object.keys(manifest.postMeta ?? {}))
      if (!/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,99}$/.test(key)) errors.push(`postMeta: khoá "${key}" không hợp lệ (chữ, số, _ - . :, tối đa 100 ký tự)`);
    for (const name of Object.keys(manifest.pageTemplates ?? {}))
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) errors.push(`pageTemplates: tên template "${name}" không hợp lệ (chữ thường, số, gạch ngang)`);
    if (!manifest.backend && !manifest.admin && !manifest.frontend && !declared) errors.push("Plugin cần ít nhất một phần: backend, admin, frontend hoặc khai báo (collections, settings, postTypes…)");
    for (const [name, c] of Object.entries(manifest.collections ?? {})) {
      if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) errors.push(`collections: tên bảng không hợp lệ: ${name}`);
      const types = ["text", "textarea", "email", "tel", "url", "integer", "number", "boolean", "date", "datetime", "time", "select"];
      for (const f of c.fields ?? []) {
        if (!/^[a-z][a-zA-Z0-9]{0,40}$/.test(f.key ?? "") || ["id", "createdAt", "updatedAt"].includes(f.key)) errors.push(`collections.${name}: tên trường không hợp lệ: ${f.key}`);
        if (!types.includes(f.type ?? "text")) errors.push(`collections.${name}.${f.key}: kiểu "${f.type}" không hợp lệ (${types.join(", ")})`);
        if (f.type === "select" && !f.options?.length) errors.push(`collections.${name}.${f.key}: select cần options`);
      }
      if (!(c.fields ?? []).length) errors.push(`collections.${name}: cần ít nhất một trường`);
    }
    if (declared && !/>=\s*1\.([7-9]|\d\d)/.test(manifest.requires?.cms ?? "")) warnings.push('khai báo trong plugin.json cần CMS ≥ 1.7.0 — nên ghi "requires": { "cms": ">=1.7.0" }');
    const sources = backendSources(manifest);
    if (sources) {
      for (const s of sources) if (!/^(?!\/)(?!.*\.\.)[A-Za-z0-9_\-./*]+\.cs$/.test(s)) errors.push(`backend: đường dẫn mã nguồn không hợp lệ: ${s}`);
      const files = expandSources(dir, sources);
      if (!files.length) errors.push("backend: không thấy file .cs nào");
      for (const f of files) if (!fs.existsSync(path.join(dir, f))) errors.push(`backend: không thấy ${f}`);
      if (!/>=\s*1\.([7-9]|\d\d)/.test(manifest.requires?.cms ?? "")) warnings.push('backend dạng mã nguồn cần CMS ≥ 1.7.0 — nên ghi "requires": { "cms": ">=1.7.0" }');
    } else if (manifest.backend && !/\.dll$/i.test(manifest.backend.assembly ?? "")) errors.push("backend.assembly phải là đường dẫn .dll, vd backend/MyPlugin.dll");
    if (manifest.admin && !/\.js$/i.test(manifest.admin.entry ?? "")) errors.push("admin.entry phải là file .js đã build, vd admin/index.js");
    if (manifest.admin?.loginEntry && !/\.js$/i.test(manifest.admin.loginEntry)) errors.push("admin.loginEntry phải là file .js đã build, vd admin/login.js (nguồn: admin/src/login.tsx)");
    if (manifest.frontend && !/\.(tsx?|jsx?)$/.test(manifest.frontend.entry ?? "")) errors.push("frontend.entry phải là .ts/.tsx/.js/.jsx");
    for (const r of manifest.frontend?.routes ?? [])
      if (typeof r !== "string" || !/^\/[a-z0-9._-]+(\/[a-z0-9._-]+)*$/.test(r) || /^\/(api|_next|admin|uploads|extensions|hubs|feed)(\/|$)|^\/(sitemap\.xml|robots\.txt|favicon\.ico)$/.test(r))
        errors.push(`frontend.routes: đường dẫn "${r}" không hợp lệ hoặc trùng đường dẫn của hệ thống`);
    if (manifest.frontend && !fs.existsSync(path.join(dir, manifest.frontend.entry))) errors.push(`Không thấy ${manifest.frontend.entry}`);
    if (manifest.admin && !fs.existsSync(path.join(dir, "admin", "src")) && !fs.existsSync(path.join(dir, manifest.admin.entry)))
      errors.push("Không thấy admin/src/index.tsx (source) hoặc bundle admin đã build");
    for (const w of checkSources(dir, manifest)) warnings.push(w);
    const legacy = findLegacyCalls(path.join(dir, "admin", "src"));
    if (legacy.length) warnings.push(`__("…") kiểu cũ ở ${legacy.slice(0, 3).join(", ")}${legacy.length > 3 ? ` (+${legacy.length - 3})` : ""} — dùng createT("${manifest.slug}") với locales/*.json`);
    if (manifest.backend && !sources && !(fs.existsSync(path.join(dir, "backend")) && fs.readdirSync(path.join(dir, "backend")).some((f) => f.endsWith(".csproj"))) && !fs.existsSync(path.join(dir, manifest.backend.assembly)))
      errors.push("Không thấy backend/*.csproj hoặc DLL đã build");
  }
  return { kind, manifest, errors, warnings };
}

const LOCALE_FILE = /^[a-z]{2}(-[a-z0-9]{2,8})?\.json$/i;
const KEY = /^[A-Za-z0-9_][\w.-]*$/;
/** Tên biến của thông điệp ICU (kể cả trong plural/select lồng nhau). */
function argsOf(ast, out = new Set()) {
  for (const el of ast) {
    if (typeof el.value === "string" && el.type !== 0 && el.type !== 7) out.add(el.value);
    if (el.options) for (const o of Object.values(el.options)) argsOf(o.value, out);
    if (el.children) argsOf(el.children, out);
  }
  return out;
}

/** locales/{ngôn-ngữ}.json: { "khoa": "thông điệp ICU" } — cú pháp ICU, khoá và biến khớp giữa các ngôn ngữ. */
/** Quyền trong manifest: viết sai → lỗi; quyền toàn phần mà chỉ cần vài domain / thư mục riêng → gợi ý quyền hẹp (CMS ≥ 1.8.0). */
function checkPermissions(perms, errors, warnings) {
  if (perms === undefined) return;
  if (!Array.isArray(perms) || perms.some((p) => typeof p !== "string")) { errors.push('"permissions" phải là mảng chuỗi'); return; }
  const host = /^network:(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  for (const p of perms) {
    const known = ["network", "filesystem", "database:core", "admin:sensitive", "files"].includes(p) || host.test(p) || /^files:\d{1,6}(mb|gb)$/.test(p);
    if (!known) errors.push(`Quyền không hợp lệ: "${p}" — dùng network:<domain>, network:*.<domain>, files, files:<N>mb, network, filesystem, database:core, admin:sensitive`);
  }
  if (perms.includes("network")) warnings.push('Quyền "network" toàn phần bị bộ quét cảnh báo — nếu chỉ gọi vài domain, khai báo "network:<domain>" và gọi qua ctx.Http (CMS ≥ 1.8.0)');
  if (perms.includes("filesystem")) warnings.push('Quyền "filesystem" toàn phần bị bộ quét cảnh báo — nếu chỉ cần lưu file của plugin, khai báo "files" (hoặc "files:500mb") và dùng ctx.Files (CMS ≥ 1.8.0)');
}

/** Nhãn "%khoá%" trong manifest phải có trong locales/*.json của gói (CMS dịch theo ngôn ngữ người xem, CMS ≥ 1.8.0). */
function checkLabelKeys(manifest, dicts, kind, errors, warnings) {
  const refs = new Set();
  const visit = (v) => {
    if (typeof v === "string") { const m = /^%([A-Za-z][\w.-]*)%$/.exec(v); if (m) refs.add(m[1]); }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(manifest);
  if (!refs.size) return;
  const codes = Object.keys(dicts);
  if (!codes.length) { errors.push(`${kind}.json dùng nhãn "%khoá%" nhưng không có locales/*.json`); return; }
  for (const key of refs) if (!codes.some((c) => key in dicts[c])) errors.push(`Nhãn "%${key}%" không có trong locales/*.json`);
  if (!/>=\s*1\.([8-9]|\d\d)/.test(manifest.requires?.cms ?? "")) warnings.push('nhãn "%khoá%" cần CMS ≥ 1.8.0 (bản cũ hiện nguyên chữ) — nên ghi "requires": { "cms": ">=1.8.0" }');
}

function checkLocales(dir, errors, warnings) {
  const localesDir = path.join(dir, "locales");
  if (!fs.existsSync(localesDir)) return {};
  const dicts = {};
  for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
    if (!LOCALE_FILE.test(file)) { errors.push(`locales/${file}: tên file phải là mã ngôn ngữ, vd vi.json, en.json`); continue; }
    const dict = readJson(path.join(localesDir, file));
    if (!dict || typeof dict !== "object" || Array.isArray(dict) || !Object.values(dict).every((v) => typeof v === "string")) {
      errors.push(`locales/${file}: phải là JSON { "khoa": "thông điệp" }`); continue;
    }
    const code = file.slice(0, -5);
    dicts[code] = {};
    for (const [key, msg] of Object.entries(dict)) {
      if (!KEY.test(key)) errors.push(`locales/${file}: khoá "${key}" không hợp lệ (chữ, số, dấu chấm, gạch)`);
      try { dicts[code][key] = [...argsOf(new IntlMessageFormat(msg, code, undefined, { ignoreTag: true }).getAst())].sort().join(","); }
      catch (e) { errors.push(`locales/${file}: "${key}" sai cú pháp ICU (${e.message})`); }
    }
  }
  const codes = Object.keys(dicts);
  const keys = new Set(codes.flatMap((c) => Object.keys(dicts[c])));
  for (const key of keys) {
    const missing = codes.filter((c) => !(key in dicts[c]));
    if (missing.length) warnings.push(`locales: "${key}" thiếu ở ${missing.map((c) => `${c}.json`).join(", ")}`);
    const vars = new Set(codes.filter((c) => key in dicts[c]).map((c) => dicts[c][key]));
    if (vars.size > 1) errors.push(`locales: biến của "${key}" lệch giữa các ngôn ngữ (${codes.filter((c) => key in dicts[c]).map((c) => `${c}: {${dicts[c][key]}}`).join(" · ")})`);
  }
  return dicts;
}

/**
 * API đã đánh dấu bỏ (deprecated) — hợp đồng công khai (docs/public-contract.md của CMS): còn chạy ít nhất tới bản major kế tiếp,
 * `validate` cảnh báo để người viết plugin/theme chuyển trước. Bỏ API nào thì thêm một dòng ở đây (since = bản CMS/SDK bắt đầu cảnh báo).
 */
const DEPRECATIONS = [
  { re: /(?<![\w$.])registerTranslations\(/g, since: "1.4.0", message: "registerTranslations() đã cũ — dùng locales/*.json + createT(slug)" },
];

/** Mã nguồn của gói (bỏ node_modules, thư mục build). */
function sourceFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".next" || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(p);
    }
  })(dir);
  return out;
}

/** Cảnh báo từ mã nguồn: API đã bỏ, tên khối defineBlock không theo dạng "slug/tên" (tên không có "/" dành cho khối lõi). */
function checkSources(dir, manifest) {
  const warnings = [];
  for (const file of sourceFiles(dir)) {
    const code = fs.readFileSync(file, "utf8");
    const at = (i) => `${path.relative(dir, file)}:${code.slice(0, i).split("\n").length}`;
    for (const d of DEPRECATIONS) for (const m of code.matchAll(d.re)) warnings.push(`${at(m.index)}: ${d.message} (đã cũ từ ${d.since}, bỏ ở bản major kế tiếp)`);
    for (const m of code.matchAll(/defineBlock\(\s*\{[^]*?\bname:\s*["'`]([^"'`]+)["'`]/g))
      if (!m[1].startsWith(`${manifest.slug}/`)) warnings.push(`${at(m.index)}: tên khối "${m[1]}" nên là "${manifest.slug}/${m[1].split("/").pop()}" — tên không có "/" dành cho khối lõi của CMS (vd callout, columns), dễ trùng ở bản sau`);
  }
  return warnings;
}

function findLegacyCalls(srcDir) {
  const out = [];
  if (!fs.existsSync(srcDir)) return out;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
      const code = fs.readFileSync(p, "utf8");
      for (const m of code.matchAll(/(?<![\w$.])__\(\s*["'`]/g)) out.push(`${path.relative(path.dirname(srcDir), p)}:${code.slice(0, m.index).split("\n").length}`);
    }
  })(srcDir);
  return out;
}

/** Import tên cũ "@cms/…" / "@ecomcx/nexus-…": CMS vẫn chạy được, nhắc đổi sang tên gói npm hiện tại. */
function checkOldImports(dir, warnings) {
  const found = new Map();
  const walk = (d, depth = 0) => {
    if (depth > 6 || !fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["node_modules", "dist", ".next", ".git"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(tsx?|jsx?|mjs)$/.test(e.name))
        for (const m of fs.readFileSync(p, "utf8").matchAll(/["'](@cms\/(theme-sdk|admin-sdk|content)|@ecomcx\/nexus-(theme-sdk|admin-sdk|content))["']/g))
          if (!found.has(m[1])) found.set(m[1], path.relative(dir, p));
    }
  };
  walk(dir);
  const NEW = OLD_NAMES;
  for (const [old, file] of found)
    warnings.push(`${file}: import "${old}" là tên cũ — đổi sang "${NEW[old]}" (cài: npm i -D ${NEW[old]}; hoặc npx @ecomcx/create-ecomweb upgrade)`);
}
