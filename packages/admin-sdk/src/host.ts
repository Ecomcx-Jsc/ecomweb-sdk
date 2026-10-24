import type { CmsAdmin } from "./types";

/** Admin host đặt object này vào globalThis.__CMS_ADMIN__ trước khi nạp bundle của plugin. */
export function host(): CmsAdmin {
  const h = (globalThis as any).__CMS_ADMIN__ as CmsAdmin | undefined;
  if (!h) throw new Error("@ecomcx/ecomweb-admin-sdk: chỉ chạy được bên trong trang quản trị CMS");
  return h;
}
