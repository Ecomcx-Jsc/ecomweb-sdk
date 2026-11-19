// clone / pull / push: mã nguồn theme/plugin giữa máy bạn và CMS (qua token API).
// .ecomweb/remote.json ghi lại "bản gốc" lấy từ server lần gần nhất: {url, kind, slug, version, hash, files: {đường-dẫn: sha256}}
// → pull biết file nào server đã đổi, file nào bạn đã sửa; push biết server có bị ai sửa không.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { connect } from "./auth.mjs";
import { c } from "./util.mjs";

const META = path.join(".ecomweb", "remote.json");
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const kindPath = (kind) => (kind === "theme" ? "themes" : "plugins");

export const readRemote = (dir) => {
  const f = path.join(dir, META);
  if (!fs.existsSync(f)) throw new Error("Thư mục này chưa được clone từ CMS (không có .ecomweb/remote.json) — dùng `create-ecomweb clone <slug>`");
  return JSON.parse(fs.readFileSync(f, "utf8"));
};
const writeRemote = (dir, meta) => {
  fs.mkdirSync(path.join(dir, ".ecomweb"), { recursive: true });
  fs.writeFileSync(path.join(dir, META), JSON.stringify(meta, null, 2) + "\n");
};

async function getJson(conn, url) {
  const r = await fetch(url, { headers: conn.auth });
  if (r.status === 404) throw new Error("Không thấy trên CMS (sai slug, hoặc chưa cài)");
  if (r.status === 401 || r.status === 403) throw new Error(`CMS từ chối (${r.status}) — token cần quyền cài theme/plugin`);
  if (!r.ok) throw new Error(`CMS trả ${r.status}`);
  return r.json();
}

export const remoteInfo = (conn, kind, slug) => getJson(conn, `${conn.base}/api/admin/${kindPath(kind)}/${slug}/package/info`);

async function download(conn, kind, slug) {
  const r = await fetch(`${conn.base}/api/admin/${kindPath(kind)}/${slug}/package`, { headers: conn.auth });
  if (!r.ok) throw new Error(`Tải mã nguồn thất bại (${r.status})`);
  return new AdmZip(Buffer.from(await r.arrayBuffer()));
}

/** Ghi file zip vào dir, chặn đường dẫn thoát khỏi thư mục (zip slip). */
function writeEntry(dir, rel, data) {
  const dest = path.resolve(dir, rel);
  if (!dest.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Đường dẫn không hợp lệ trong gói: ${rel}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
}

export async function clone(slug, { kind = "theme", dir, ...opts }) {
  const conn = await connect(opts);
  dir = path.resolve(dir ?? slug);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${path.relative(process.cwd(), dir) || "."} đã có file — clone vào thư mục trống`);
  const info = await remoteInfo(conn, kind, slug);
  const zip = await download(conn, kind, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const e of zip.getEntries()) if (!e.isDirectory) writeEntry(dir, e.entryName, e.getData());
  writeRemote(dir, { url: conn.base, kind, slug, version: info.version, hash: info.hash, files: info.files });
  console.log(c.green(`✓ Đã clone ${kind} ${slug} ${info.version}`) + c.dim(` → ${path.relative(process.cwd(), dir) || "."} (${Object.keys(info.files).length} file)`));
}

const localHash = (dir, rel) => {
  const f = path.join(dir, rel);
  return fs.existsSync(f) && fs.statSync(f).isFile() ? sha(fs.readFileSync(f)) : null;
};

export async function pull(dir, { force = false, ...opts }) {
  const meta = readRemote(dir);
  const conn = await connect({ ...opts, url: opts.url ?? meta.url });
  const info = await remoteInfo(conn, meta.kind, meta.slug);
  if (info.hash === meta.hash) { console.log(c.green("✓ Đã mới nhất") + c.dim(` (${meta.version})`)); return; }

  // Mỗi file: server đổi so với bản gốc? local đã sửa so với bản gốc? → ghi / bỏ qua / xung đột (chưa ghi gì cho tới khi xét xong)
  const write = [], remove = [], conflicts = [];
  for (const rel of new Set([...Object.keys(meta.files), ...Object.keys(info.files)])) {
    const base = meta.files[rel] ?? null, server = info.files[rel] ?? null;
    if (server === base) continue;
    const local = localHash(dir, rel);
    if (local === server) continue;                 // hai bên đã giống nhau
    if (local === base || force) (server ? write : remove).push(rel);
    else conflicts.push(rel);
  }
  if (conflicts.length) {
    console.log(c.red("✗ Cả server và máy bạn đều sửa các file này — chưa ghi gì:"));
    conflicts.forEach((f) => console.log("  - " + f));
    throw new Error("Giải quyết xung đột (sao lưu file của bạn) rồi `pull --force` để lấy bản server");
  }
  if (write.length) {
    const zip = await download(conn, meta.kind, meta.slug);
    for (const rel of write) {
      const e = zip.getEntry(rel);
      if (!e) throw new Error(`Server thiếu file ${rel} (vừa bị đổi) — chạy lại pull`);
      writeEntry(dir, rel, e.getData());
    }
  }
  for (const rel of remove) fs.rmSync(path.join(dir, rel), { force: true });
  writeRemote(dir, { ...meta, version: info.version, hash: info.hash, files: info.files });
  console.log(c.green(`✓ Đã pull ${meta.slug} ${meta.version} → ${info.version}`) + c.dim(` (ghi ${write.length}, xoá ${remove.length})`));
}

/** Trước khi push: từ chối nếu server đã đổi (trả baseHash để server kiểm lại lúc upload). */
export async function pushGuard(dir, { force = false, ...opts }) {
  const meta = readRemote(dir);
  const conn = await connect({ ...opts, url: opts.url ?? meta.url });
  const info = await remoteInfo(conn, meta.kind, meta.slug).catch((e) => (/Không thấy/.test(e.message) ? null : Promise.reject(e)));
  if (info && info.hash !== meta.hash && !force)
    throw new Error(`Server đã thay đổi từ lần pull gần nhất (${meta.version} → ${info.version}). Chạy \`pull\` trước, hoặc \`push --force\` để ghi đè.`);
  return { meta, baseHash: force ? undefined : meta.hash, url: meta.url };
}

/** Sau push thành công: ghi lại bản trên server làm bản gốc mới. */
export async function afterPush(dir, meta, opts) {
  const conn = await connect({ ...opts, url: opts.url ?? meta.url });
  const info = await remoteInfo(conn, meta.kind, meta.slug);
  writeRemote(dir, { ...meta, version: info.version, hash: info.hash, files: info.files });
}
