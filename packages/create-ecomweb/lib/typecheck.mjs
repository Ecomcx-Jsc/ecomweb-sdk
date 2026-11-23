import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Kiểm tra kiểu TypeScript (tsc --noEmit) của theme / plugin trước khi deploy / push.
 * Server chỉ kiểm kiểu khi cài plugin có phần website cùng theme — lỗi kiểu lọt qua push (build Next không dừng vì kiểu) rồi mới chặn plugin;
 * chạy ở đây để lỗi hiện ngay ở máy tác giả. Dùng typescript và @ecomcx/ecomweb-theme-sdk đã cài trong thư mục (npm install).
 * Trả về { status: "ok" | "failed" | "missing" | "none", output?, reason? }.
 */
export function typecheck(dir) {
  if (!fs.existsSync(path.join(dir, "tsconfig.json"))) return { status: "none", reason: "không có tsconfig.json" };
  const hasTs = ["templates", "components", "lib", "frontend", "admin"].some((d) => fs.existsSync(path.join(dir, d)))
    || fs.readdirSync(dir).some((f) => /\.tsx?$/.test(f));
  if (!hasTs) return { status: "none", reason: "không có mã TypeScript" };
  const tsc = path.join(dir, "node_modules", "typescript", "bin", "tsc");
  if (!fs.existsSync(tsc)) return { status: "missing", reason: "chưa cài typescript — chạy `npm install` trong thư mục này" };
  const r = spawnSync(process.execPath, [tsc, "--noEmit", "-p", dir, "--pretty", "false"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  return r.status === 0 ? { status: "ok" } : { status: "failed", output };
}

/** Dùng trong deploy / push: lỗi kiểu (hoặc chưa cài typescript) → ném lỗi, trừ khi --skip-check. */
export function requireTypecheck(dir, { skip = false, log = console.log } = {}) {
  if (skip) { log("• bỏ qua kiểm tra kiểu (--skip-check)"); return; }
  const r = typecheck(dir);
  if (r.status === "none") return;
  if (r.status === "missing") throw new Error(`Không kiểm được kiểu: ${r.reason}.\n  Hoặc dùng --skip-check (không khuyến khích: server vẫn chặn khi cài plugin có phần website).`);
  if (r.status === "failed") {
    const lines = r.output.split("\n");
    throw new Error(`Lỗi TypeScript — dừng, chưa tải lên:\n${lines.slice(0, 30).map((l) => "  " + l).join("\n")}${lines.length > 30 ? `\n  … và ${lines.length - 30} dòng nữa` : ""}`);
  }
  log("✓ kiểm tra kiểu TypeScript");
}
