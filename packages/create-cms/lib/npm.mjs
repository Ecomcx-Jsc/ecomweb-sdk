import { readFileSync } from "node:fs";

// Gói npm (org @ecomcx) — theme/plugin import đúng tên này
export const THEME_SDK = "@ecomcx/ecomweb-theme-sdk", ADMIN_SDK = "@ecomcx/ecomweb-admin-sdk", CONTENT = "@ecomcx/ecomweb-content";
export const CLI = "@ecomcx/create-ecomweb";
/**
 * Tên cũ → tên mới: core vẫn hiểu import cũ, validate nhắc đổi, upgrade giữ bí danh để code cũ còn chạy.
 * "@cms/…" = trước khi lên npm; "@ecomcx/nexus-…" = tên sản phẩm trước Ecomweb.
 */
export const OLD_NAMES = {
  "@cms/theme-sdk": THEME_SDK, "@cms/admin-sdk": ADMIN_SDK, "@cms/content": CONTENT,
  "@ecomcx/nexus-theme-sdk": THEME_SDK, "@ecomcx/nexus-admin-sdk": ADMIN_SDK, "@ecomcx/nexus-content": CONTENT,
};
/** Phiên bản của CLI = phiên bản SDK phát hành cùng đợt. */
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
