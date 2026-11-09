// CMS from the Store when the prebuilt image cannot be pulled (not published yet, removed, renamed, registry down):
// the built package of the latest stable release, checked like the CMS updater does (Store signature with the pinned key,
// then the SHA-256 in the signed content), extracted into .cms-env/ and turned into the image with its own Dockerfile
// (only copies files, about a minute). Same format as core updater/signed-release.mjs (ECDSA P-256 / SHA-256, IEEE P1363).
import { createHash, createPublicKey, verify } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { run } from "./util.mjs";

export const OFFICIAL_STORE = "https://store.ecomcx.com";
const OFFICIAL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEx5o4MLQrj0bDr6hpsRqzk+rqVSrk
UY1kmTNSLXVCHP60ZQIU1MwLbtdldWAQTDfJIMRWNMlZoMp11Cg4zegs9g==
-----END PUBLIC KEY-----`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** Signed content of one item of GET <Store>/api/core/releases, or null when the signature / content is wrong. */
export function verifyItem(publicKeyPem, item) {
  const { version, payload, signature } = item ?? {};
  if (typeof version !== "string" || typeof payload !== "string" || typeof signature !== "string") return null;
  const canonical = `cms-package-v1|core|ecomweb|${version}|${sha256(Buffer.from(payload, "utf8"))}`;
  let ok = false;
  try { ok = verify("sha256", Buffer.from(canonical, "utf8"), { key: createPublicKey(publicKeyPem), dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64")); }
  catch { ok = false; }
  if (!ok) return null;
  const p = JSON.parse(payload);
  return p?.kind === "core" && p?.version === version ? p : null;
}

const core = (v) => v.split("-")[0].split(".").map(Number);
const newer = (a, b) => { const x = core(a), y = core(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

/**
 * Latest stable release with a built package -> image built here. Returns { version, apiImage, builderImage }
 * (one image since CMS 1.25; two for older packages, built from their own two Dockerfiles).
 */
export async function cmsFromStore(envDir, { storeUrl, publicKey, log }) {
  const store = (storeUrl || OFFICIAL_STORE).replace(/\/$/, "");
  const key = publicKey || (store === OFFICIAL_STORE ? OFFICIAL_PUBLIC_KEY : "");
  if (!key) throw new Error(`Store ${store}: cần khoá công khai của Store (STORE_PUBLIC_KEY, lấy ở ${store}/api/public-key) để kiểm chữ ký`);
  const r = await fetch(`${store}/api/core/releases`, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`Store ${store}: HTTP ${r.status}`);
  const releases = (await r.json()).filter((x) => !x.yanked && typeof x.version === "string" && !x.version.includes("-"))
    .map((x) => verifyItem(key, x)).filter((x) => x?.packages?.built);
  const release = releases.sort((a, b) => newer(b.version, a.version))[0];
  if (!release) throw new Error(`Store ${store} chưa có bản phát hành ổn định có gói đã build (hoặc chữ ký không khớp khoá)`);
  const built = release.packages.built;
  if (!built.url?.startsWith("/") || !/^[a-f0-9]{64}$/.test(built.sha256 ?? "")) throw new Error(`Bản ${release.version}: thông tin gói không hợp lệ`);

  const root = path.join(envDir, "cms", release.version);
  const src = path.join(root, `ecomweb-${release.version}`);
  const one = `ecomweb:${release.version}`;
  const local = async (img) => run("docker", ["image", "inspect", img], { quiet: true }).then(() => true, () => false);
  if (await local(one)) return { version: release.version, apiImage: one, builderImage: one };

  if (!fs.existsSync(path.join(src, "VERSION"))) {
    log(`• Tải CMS ${release.version} từ Store (${(built.size / 1048576).toFixed(0)} MB)…`);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    const res = await fetch(store + built.url, { signal: AbortSignal.timeout(30 * 60_000) });
    if (!res.ok) throw new Error(`Tải gói: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const got = sha256(bytes);
    if (got !== built.sha256) throw new Error(`SHA-256 của gói không khớp bản Store đã ký (${got}) — không dùng`);
    const file = path.join(root, built.file ?? "package.tar.gz");
    fs.writeFileSync(file, bytes);
    await run("tar", ["-xzf", file, "-C", root], { quiet: true });
    fs.rmSync(file);
  }
  log(`• Dựng image CMS ${release.version} từ gói (chỉ chép file, khoảng một phút)…`);
  const build = (dockerfile, tag) => run("docker", ["build", "-q", "--build-arg", "TREE=package", "-f", path.join(src, dockerfile), "-t", tag, src], { quiet: true });
  if (fs.existsSync(path.join(src, "deploy", "Dockerfile"))) {
    await build("deploy/Dockerfile", one);
    return { version: release.version, apiImage: one, builderImage: one };
  }
  // CMS 1.24 and older: one image per role
  await build("deploy/docker/api.Dockerfile", `cms-api:${release.version}`);
  await build("deploy/docker/builder.Dockerfile", `cms-builder:${release.version}`);
  return { version: release.version, apiImage: `cms-api:${release.version}`, builderImage: `cms-builder:${release.version}` };
}
