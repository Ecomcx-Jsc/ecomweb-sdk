// Môi trường CMS chạy bằng Docker cho người làm theme/plugin — không cần mã nguồn CMS.
//   create-ecomweb env up      dựng CMS (Postgres, Redis, API, website, Caddy) + cài đặt sẵn, in tài khoản quản trị
//   create-ecomweb env status  trạng thái, địa chỉ, tài khoản
//   create-ecomweb env down    dừng (giữ dữ liệu)  ·  --purge: xoá luôn dữ liệu
//   create-ecomweb env logs [api|builder|…] [-f]   xem log
//   --dev        website chạy `next dev`; theme/plugin trong thư mục hiện tại (và thư mục con) được gắn thẳng vào → sửa là thấy
//   --build DIR  build image từ mã nguồn CMS ở DIR (khi chưa kéo được image dựng sẵn)
// Tài khoản được lưu ở .cms-env/credentials.json → `create-ecomweb deploy/dev` tự dùng, không cần --password.
import { CLI } from "./npm.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { c, readJson, run, write } from "./util.mjs";

const cliDir = path.dirname(fileURLToPath(import.meta.url));
/** Image dựng sẵn của CMS (đổi bằng --api-image/--builder-image hoặc biến CMS_API_IMAGE/CMS_BUILDER_IMAGE). */
const DEFAULT_IMAGES = { api: "ghcr.io/ecomcx-jsc/ecomweb-api:latest", builder: "ghcr.io/ecomcx-jsc/ecomweb-builder:latest" };

/** Theme/plugin đang viết ở thư mục hiện tại và thư mục con (+ --mount) → gắn vào Builder khi chạy --dev. */
export function devMounts(args) {
  const roots = [process.cwd(), ...fs.readdirSync(process.cwd(), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules").map((d) => path.resolve(d.name))];
  for (const m of [args.mount ?? []].flat()) roots.push(path.resolve(m));
  const mounts = [];
  for (const dir of [...new Set(roots)]) {
    const theme = readJson(path.join(dir, "theme.json"));
    const plugin = readJson(path.join(dir, "plugin.json"));
    if (theme?.slug) mounts.push({ kind: "theme", slug: theme.slug, dir, target: `/app/frontend/themes/${theme.slug}` });
    else if (plugin?.slug && plugin.frontend?.entry) mounts.push({ kind: "plugin", slug: plugin.slug, dir, target: `/dev-plugins/${plugin.slug}` });
  }
  return mounts;
}

/** File cấu hình đi kèm gói (lib/env/) hoặc lấy từ thư mục deploy/ khi chạy trong repo CMS. */
function asset(name) {
  for (const p of [path.join(cliDir, "env", name), path.resolve(cliDir, "../../../deploy", name)]) if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  throw new Error(`Thiếu file ${name} của create-ecomweb`);
}

/** Tìm .cms-env gần nhất (thư mục hiện tại hoặc thư mục cha) — dùng cho deploy/dev. */
export function findEnv(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    const cred = readJson(path.join(dir, ".cms-env", "credentials.json"));
    if (cred) return cred;
    if (path.dirname(dir) === dir) return null;
  }
}

const compose = (o) => `
# Sinh bởi create-ecomweb env — môi trường thử cho theme/plugin. Không dùng cho website thật.
name: ${o.project}
services:
  init:
    image: alpine:3.20
    command: ["/bin/sh", "/init-secrets.sh"]
    volumes: [secrets:/secrets, ./init-secrets.sh:/init-secrets.sh:ro]
    restart: "no"
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    depends_on: { init: { condition: service_completed_successfully } }
    environment: { POSTGRES_USER: cms, POSTGRES_DB: cms, POSTGRES_PASSWORD_FILE: /secrets/db_password }
    volumes: [pgdata:/var/lib/postgresql/data, secrets:/secrets:ro]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U cms"], interval: 3s, retries: 40 }
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 3s, retries: 20 }
  api:
${o.buildDir ? `    build: { context: ${JSON.stringify(o.buildDir)}, dockerfile: backend/Dockerfile }\n    image: cms-env-api:local` : `    image: ${o.apiImage}`}
    restart: unless-stopped
    depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_healthy } }
    environment:
      CMS_SECRETS_DIR: /secrets
      ConnectionStrings__Redis: redis:6379
      Storage__PublicMediaUrl: ${o.url}/uploads
      Frontend__PublicUrl: ${o.url}
      Frontend__RevalidateUrl: http://builder:3000/api/revalidate
      Extensions__BuilderUrl: http://builder:4100
      Extensions__CallbackBaseUrl: http://api:8080
      Setup__AdminUrl: ${o.url}/admin
      Security__TrustedProxyHosts__0: caddy
      Cors__Origins__0: ${o.url}
      Security__FrameAncestors__0: ${o.url}
    volumes: [storage:/data, secrets:/secrets:ro]
  builder:
${o.buildDir ? `    build: { context: ${JSON.stringify(o.buildDir)}, dockerfile: builder/Dockerfile }\n    image: cms-env-builder:local` : `    image: ${o.builderImage}`}
    restart: unless-stopped
    depends_on: [api]
    environment: { CMS_SECRETS_DIR: /secrets, CMS_API_URL: http://api:8080, ADMIN_ORIGINS: ${o.url}, WEB_WORKERS: "1", TRUSTED_PROXY_HOSTS: caddy${o.dev ? ", BUILDER_MODE: dev, BUILDER_DEV_SERVER: \"1\"" : ""} }
    volumes: [storage:/data, secrets:/secrets:ro${(o.mounts ?? []).map((m) => `, ${JSON.stringify(`${m.dir}:${m.target}:ro`)}`).join("")}]
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [api, builder]
    environment: { SITE_ADDRESS: ":80" }
    ports: ["${o.port}:80"]
    volumes: [./Caddyfile:/etc/caddy/Caddyfile:ro]
volumes: { pgdata: {}, storage: {}, secrets: {} }
`;

/** Cổng còn trống trên máy (Docker sẽ báo "port is already allocated" ở bước cuối, sau khi đã tạo container). */
function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}

async function waitFor(url, seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); if (r.ok) return true; } catch { /* chưa sẵn sàng */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export async function env(action, args) {
  const dir = path.resolve(args.dir ?? ".cms-env");
  const credFile = path.join(dir, "credentials.json");
  const saved = readJson(credFile);
  const project = saved?.project ?? `cms-dev-${crypto.createHash("sha1").update(dir).digest("hex").slice(0, 6)}`;
  const dc = (...a) => run("docker", ["compose", "-f", path.join(dir, "docker-compose.yml"), ...a], { quiet: true });

  if (action === "up") {
    const port = Number(args.port ?? saved?.port ?? 8080);
    const url = `http://localhost:${port}`;
    const apiImage = args["api-image"] ?? process.env.CMS_API_IMAGE ?? saved?.apiImage ?? DEFAULT_IMAGES.api;
    const builderImage = args["builder-image"] ?? process.env.CMS_BUILDER_IMAGE ?? saved?.builderImage ?? DEFAULT_IMAGES.builder;
    const dev = Boolean(args.dev ?? saved?.dev);
    const buildDir = args.build ? path.resolve(args.build) : saved?.buildDir;
    const mounts = dev ? devMounts(args) : [];
    // Môi trường đang chạy dùng lại cổng của nó; môi trường mới thì cổng phải trống
    if (!saved && !(await portFree(port))) throw new Error(`Cổng ${port} đang được dùng — chọn cổng khác: create-ecomweb env up --port ${port + 1}`);
    write(path.join(dir, "docker-compose.yml"), compose({ project, port, url, apiImage, builderImage, dev, buildDir, mounts }));
    write(path.join(dir, "Caddyfile"), asset("Caddyfile"));
    write(path.join(dir, "init-secrets.sh"), asset("init-secrets.sh"));
    write(path.join(dir, ".gitignore"), "*\n"); // tài khoản & cấu hình máy, không đưa vào git
    if (dev) {
      console.log(c.cyan(`• Chế độ dev: website chạy next dev${mounts.length ? `, gắn ${mounts.map((m) => `${m.kind} ${m.slug}`).join(", ")}` : ""}`));
      if (!mounts.length) console.log(c.yellow("  ! Không thấy theme.json/plugin.json (có phần website) trong thư mục này — chạy lệnh ở thư mục chứa theme/plugin hoặc dùng --mount"));
    }
    if (buildDir) {
      console.log(c.cyan(`• Build image từ mã nguồn ${buildDir} (lần đầu vài phút)…`));
      await dc("build");
    } else {
      const local = async (img) => run("docker", ["image", "inspect", img], { quiet: true }).then(() => true, () => false);
      const missing = [];
      for (const [svc, img] of [["api", apiImage], ["builder", builderImage]]) if (!(await local(img))) missing.push(svc);
      if (missing.length) console.log(c.cyan(`• Kéo image ${apiImage}…`));
      try { if (missing.length) await dc("pull", ...missing); }
      catch (e) {
        throw new Error(`Không kéo được image CMS (${apiImage}). Image có thể chưa được phát hành công khai.\n`
          + `  Có mã nguồn CMS: create-ecomweb env up --build <thư-mục-mã-nguồn>\n  Hoặc chỉ định image khác: --api-image … --builder-image …\n  Chi tiết: ${e.message.split("\n").slice(-2).join(" ")}`);
      }
    }
    try { await dc("up", "-d"); }
    catch (e) {
      // Lần chạy đầu hỏng giữa chừng: gỡ container vừa tạo, không để lại stack mồ côi (chưa có credentials.json để env down)
      if (!saved) await dc("down", "-v", "--remove-orphans").catch(() => {});
      throw e;
    }
    if (!(await waitFor(`${url}/api/health`, 240))) throw new Error(`CMS chưa phản hồi ở ${url} — xem log: docker compose -f ${path.relative(process.cwd(), dir)}/docker-compose.yml logs api`);

    // Lần đầu website được build (1–2 phút) — chờ xong để mở ra là dùng được ngay
    console.log(c.cyan("• Chờ website sẵn sàng (lần đầu cần build)…"));
    const until = Date.now() + 600_000;
    for (;;) {
      const st = await fetch(url, { signal: AbortSignal.timeout(20_000) }).then((r) => r.status, () => 0);
      if (st && st !== 502 && st !== 503) break;
      if (Date.now() > until) throw new Error("Website chưa build xong sau 10 phút — xem log: docker compose logs builder");
      await new Promise((r) => setTimeout(r, 3000));
    }

    let cred = saved;
    const setup = await (await fetch(`${url}/api/setup`)).json();
    if (setup.needsSetup && args["no-setup"]) {
      // Tự trải nghiệm màn hình cài đặt như người dùng cuối
      const token = (await dc("exec", "-T", "api", "cat", "/data/state/setup-token")).trim();
      write(credFile, JSON.stringify({ project, port, url, apiImage, builderImage }, null, 2) + "\n");
      console.log(c.green("✓ CMS đã chạy, chưa cài đặt"));
      console.log(`  Mở ${url}/admin — mã cài đặt: ${c.bold(token)}`);
      return;
    }
    if (setup.needsSetup) {
      // Cài đặt lần đầu bằng chính màn hình cài đặt của CMS (mã cài đặt đọc trong container)
      const token = (await dc("exec", "-T", "api", "cat", "/data/state/setup-token")).trim();
      const password = crypto.randomBytes(12).toString("base64url");
      const res = await fetch(`${url}/api/setup`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, siteTitle: args.title ?? "Website thử", language: args.lang ?? "vi", timezone: "Asia/Ho_Chi_Minh",
          adminUserName: "admin", adminEmail: "admin@example.com", adminPassword: password, sampleContent: true, discourageSearchEngines: true }),
      });
      if (!res.ok) throw new Error(`Cài đặt CMS thất bại: ${res.status} ${await res.text()}`);
      cred = { url, user: "admin", password };
    }
    cred = { ...cred, project, port, url, apiImage, builderImage, dev, buildDir, mounts: mounts.map((m) => ({ kind: m.kind, slug: m.slug, dir: m.dir })) };
    write(credFile, JSON.stringify(cred, null, 2) + "\n");
    fs.chmodSync(credFile, 0o600);
    console.log(c.green("✓ CMS đã sẵn sàng"));
    printInfo(cred, dir);
    return;
  }
  // env up hỏng trước khi lưu tài khoản: vẫn cho env down dọn theo docker-compose.yml đã ghi
  if (!saved && !(action === "down" && fs.existsSync(path.join(dir, "docker-compose.yml"))))
    throw new Error(`Chưa có môi trường ở ${dir} — chạy: npx ${CLI} env up`);
  if (action === "down") {
    await dc("down", ...(args.purge ? ["-v"] : []));
    if (args.purge) fs.rmSync(dir, { recursive: true, force: true });
    console.log(c.green(args.purge ? "✓ Đã dừng và xoá dữ liệu" : "✓ Đã dừng (dữ liệu được giữ — `env up` để chạy lại)"));
    return;
  }
  if (action === "logs") {
    const extra = (args._ ?? []).slice(2);
    const service = extra.find((x) => !x.startsWith("-"));
    const follow = args.follow || extra.includes("-f");
    await run("docker", ["compose", "-f", path.join(dir, "docker-compose.yml"), "logs", "--tail", "200", ...(follow ? ["-f"] : []), ...(service ? [service] : [])], { quiet: false });
    return;
  }
  if (action === "status") {
    const up = await waitFor(`${saved.url}/api/health`, 2);
    console.log((up ? c.green("● Đang chạy") : c.yellow("○ Đã dừng")) + (saved.dev ? c.dim(` · dev (${(saved.mounts ?? []).map((m) => m.slug).join(", ") || "không gắn thư mục"})`) : ""));
    if (saved.password) printInfo(saved, dir); else console.log(`  Website     ${saved.url}  (chưa cài đặt hoặc tự cài bằng màn hình cài đặt)`);
    return;
  }
  throw new Error("Dùng: create-ecomweb env up [--dev] [--build DIR] | status | logs [dịch vụ] [-f] | down [--purge]");
}

function printInfo(cred, dir) {
  console.log(`  Website     ${cred.url}`);
  console.log(`  Quản trị    ${cred.url}/admin   (${cred.user} / ${cred.password})`);
  console.log(c.dim(`  Tài khoản lưu ở ${path.relative(process.cwd(), path.join(dir, "credentials.json"))} — \`create-ecomweb dev\` tự dùng.`));
}
