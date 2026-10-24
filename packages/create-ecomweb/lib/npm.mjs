import { readFileSync } from "node:fs";

// Gói npm (org @ecomcx) — theme/plugin import đúng tên này
export const THEME_SDK = "@ecomcx/ecomweb-theme-sdk", ADMIN_SDK = "@ecomcx/ecomweb-admin-sdk", CONTENT = "@ecomcx/ecomweb-content";
export const CLI = "@ecomcx/create-ecomweb";
/** Phiên bản của CLI = phiên bản SDK phát hành cùng đợt. */
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
