import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG = path.join(process.env.ECOMWEB_CONFIG_DIR ?? path.join(os.homedir(), ".config", "ecomweb"), "config.json");
const norm = (u) => u.replace(/\/$/, "");

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return { sites: {} }; }
}

/** Lưu token của một site vào ~/.config/ecomweb/config.json (quyền 600; không bao giờ ở trong thư mục theme/plugin). */
export function saveToken(url, token) {
  const cfg = readConfig();
  cfg.sites = { ...cfg.sites, [norm(url)]: { token } };
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.chmodSync(CONFIG, 0o600);
}

/**
 * Địa chỉ + header xác thực. Token API (`cmsp_…`) trước: --token → CMS_TOKEN → token đã lưu bởi `login`
 * (không qua đăng nhập nên không vướng 2FA). Không có token: tài khoản + mật khẩu như trước (tài khoản bật 2FA thì không dùng được).
 */
export async function connect({ url, token, user, password } = {}) {
  const base = norm(url ?? process.env.CMS_URL ?? "http://localhost:5100");
  token ??= process.env.CMS_TOKEN ?? readConfig().sites?.[base]?.token;
  if (token) return { base, auth: { authorization: `Bearer ${token}` }, viaToken: true };
  user ??= process.env.CMS_USER ?? "admin";
  password ??= process.env.CMS_PASSWORD;
  if (!password) throw new Error(`Thiếu token: chạy \`create-ecomweb login --url ${base} --token cmsp_…\` (hoặc --token / biến CMS_TOKEN). Tạo token ở trang quản trị › Hồ sơ › Token API.`);
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: user, password }) });
  if (!login.ok) throw new Error(`Đăng nhập thất bại (${login.status})`);
  const body = await login.json();
  if (body.twoFactorRequired) throw new Error("Tài khoản bật xác thực 2 lớp — dùng token API: create-ecomweb login --url … --token cmsp_…");
  return { base, auth: { authorization: `Bearer ${body.accessToken}` }, viaToken: false };
}

/** Kiểm token còn dùng được (đọc danh sách theme — cần quyền quản trị). */
export async function verify({ base, auth }) {
  const r = await fetch(`${base}/api/admin/themes`, { headers: auth });
  if (r.status === 401) throw new Error("Token không hợp lệ hoặc đã bị thu hồi (401)");
  if (r.status === 403) throw new Error("Token không đủ quyền quản trị theme/plugin (403)");
  if (!r.ok) throw new Error(`CMS trả ${r.status}`);
}
