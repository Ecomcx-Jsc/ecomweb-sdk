import { IntlMessageFormat } from "intl-messageformat";
import { cache } from "react";
import { getSite } from "./api";
import { getActiveTheme } from "./runtime";
import { formatMessage } from "./i18n-format";

/** Chữ mặc định của các component trong SDK (theme có thể ghi đè trong locales/{code}.json). */
export const BUILTIN: Record<string, Record<string, string>> = {
  vi: {
    "search.placeholder": "Tìm kiếm…", "search.button": "Tìm", "search.label": "Từ khoá", "navigation.menu": "Menu", "toc.title": "Mục lục",
    "pagination.prev": "« Trước", "pagination.next": "Sau »", "pagination.label": "Phân trang",
    "comments.title": "Bình luận", "comments.closed": "Bình luận đã đóng.",
    "comments.form.title": "Để lại bình luận", "comments.form.content": "Bình luận", "comments.form.name": "Tên",
    "comments.form.email": "Email", "comments.form.website": "Website", "comments.form.submit": "Gửi bình luận",
    "comments.form.sending": "Đang gửi…", "comments.form.approved": "Cảm ơn bạn! Bình luận đã được đăng (tải lại trang để xem).",
    "comments.form.pending": "Cảm ơn bạn! Bình luận đang chờ duyệt.", "comments.form.error": "Không gửi được bình luận",
    "comments.more": "Xem thêm bình luận", "comments.loading": "Đang tải…",
    "password.intro": "Nội dung này được bảo vệ bằng mật khẩu. Nhập mật khẩu để xem:", "password.label": "Mật khẩu",
    "password.submit": "Xem nội dung", "password.wrong": "Mật khẩu không đúng",
    "archives.month": "Tháng {month}/{year}", "language.label": "Ngôn ngữ",
    "auth.login": "Tên đăng nhập hoặc email", "auth.password": "Mật khẩu", "auth.submitLogin": "Đăng nhập", "auth.code": "Mã xác thực (6 số)",
    "auth.verify": "Xác nhận", "auth.userName": "Tên đăng nhập", "auth.email": "Email", "auth.displayName": "Tên hiển thị",
    "auth.submitRegister": "Tạo tài khoản", "auth.submitForgot": "Gửi liên kết đặt lại", "auth.newPassword": "Mật khẩu mới (tối thiểu 10 ký tự)",
    "auth.submitReset": "Đặt mật khẩu", "auth.sending": "Đang xử lý…", "auth.error": "Có lỗi xảy ra, vui lòng thử lại", "auth.logout": "Đăng xuất",
    "auth.noAccount": "Chưa có tài khoản?", "auth.register": "Đăng ký", "auth.forgot": "Quên mật khẩu?", "auth.haveAccount": "Đã có tài khoản?",
    "auth.login2": "Đăng nhập", "auth.registerClosed": "Website hiện không mở đăng ký thành viên.",
    "auth.missingToken": "Liên kết không hợp lệ — hãy yêu cầu đặt lại mật khẩu lần nữa.", "auth.signedInAs": "Bạn đang đăng nhập với tên {name}.",
    "file.download": "Tải tệp", "form.submit": "Gửi", "form.sending": "Đang gửi…", "form.error": "Không gửi được, vui lòng thử lại",
    "auth.bio": "Giới thiệu", "auth.currentPassword": "Mật khẩu hiện tại", "auth.currentPasswordForEmail": "Mật khẩu hiện tại (cần khi đổi email)",
    "auth.submitProfile": "Lưu hồ sơ", "auth.submitPassword": "Đổi mật khẩu", "auth.notSignedIn": "Bạn cần đăng nhập để xem trang này.",
    "auth.deleteWarning": "Xoá tài khoản là vĩnh viễn: bạn không đăng nhập được nữa, bài viết của bạn không còn tác giả.",
    "auth.deleteConfirm": "Tôi hiểu, xoá tài khoản của tôi", "auth.submitDelete": "Xoá tài khoản",
  },
  en: {
    "search.placeholder": "Search…", "search.button": "Search", "search.label": "Keyword", "navigation.menu": "Menu", "toc.title": "Contents",
    "pagination.prev": "« Previous", "pagination.next": "Next »", "pagination.label": "Pagination",
    "comments.title": "Comments", "comments.closed": "Comments are closed.",
    "comments.form.title": "Leave a comment", "comments.form.content": "Comment", "comments.form.name": "Name",
    "comments.form.email": "Email", "comments.form.website": "Website", "comments.form.submit": "Post comment",
    "comments.form.sending": "Sending…", "comments.form.approved": "Thanks! Your comment is published (reload to see it).",
    "comments.form.pending": "Thanks! Your comment is awaiting moderation.", "comments.form.error": "Could not post your comment",
    "comments.more": "Load more comments", "comments.loading": "Loading…",
    "password.intro": "This content is password protected. Enter the password to view it:", "password.label": "Password",
    "password.submit": "Enter", "password.wrong": "Incorrect password",
    "archives.month": "{month}/{year}", "language.label": "Language",
    "auth.login": "Username or email", "auth.password": "Password", "auth.submitLogin": "Log in", "auth.code": "Authentication code (6 digits)",
    "auth.verify": "Verify", "auth.userName": "Username", "auth.email": "Email", "auth.displayName": "Display name",
    "auth.submitRegister": "Create account", "auth.submitForgot": "Send reset link", "auth.newPassword": "New password (at least 10 characters)",
    "auth.submitReset": "Set password", "auth.sending": "Working…", "auth.error": "Something went wrong, please try again", "auth.logout": "Log out",
    "auth.noAccount": "No account yet?", "auth.register": "Register", "auth.forgot": "Forgot password?", "auth.haveAccount": "Already have an account?",
    "auth.login2": "Log in", "auth.registerClosed": "Registration is currently closed.",
    "auth.missingToken": "Invalid link — please request a new password reset.", "auth.signedInAs": "You are logged in as {name}.",
    "file.download": "Download", "form.submit": "Send", "form.sending": "Sending…", "form.error": "Could not send, please try again",
    "auth.bio": "Bio", "auth.currentPassword": "Current password", "auth.currentPasswordForEmail": "Current password (needed to change your email)",
    "auth.submitProfile": "Save profile", "auth.submitPassword": "Change password", "auth.notSignedIn": "Please log in to see this page.",
    "auth.deleteWarning": "Deleting your account is permanent: you can no longer log in and your posts will have no author.",
    "auth.deleteConfirm": "I understand, delete my account", "auth.submitDelete": "Delete account",
  },
};

export type Translator = ((key: string, vars?: Record<string, string | number>) => string) & { locale: string };

/**
 * Hàm dịch chữ cho ngôn ngữ hiện tại. Thông điệp theo ICU MessageFormat: biến `{name}`, số nhiều
 * `{count, plural, one {# comment} other {# comments}}`, chọn `{gender, select, …}`.
 * Thứ tự tra: locales của theme (con → cha) → chữ có sẵn của SDK; ngôn ngữ hiện tại → mặc định → tiếng Anh → chính key.
 */
/** Từ điển theo thứ tự tra cho ngôn ngữ hiện tại (theme con → cha → SDK; hiện tại → mặc định → tiếng Anh). */
const getDicts = cache(async () => {
  const site = await getSite();
  const theme = await getActiveTheme(site);
  const order = [...new Set([site.locale, site.defaultLocale, "en"])];
  const dicts: Array<{ code: string; dict: Record<string, string> }> = [];
  for (const code of order) {
    for (const t of theme.chain) {
      const loader = t.locales?.[code];
      if (loader) { try { dicts.push({ code, dict: (await loader()).default }); } catch { /* bỏ qua */ } }
    }
    if (BUILTIN[code]) dicts.push({ code, dict: BUILTIN[code] });
  }
  return { site, dicts };
});

export const getT = cache(async (): Promise<Translator> => {
  const { site, dicts } = await getDicts();
  const compiled = new Map<string, IntlMessageFormat | null>();
  const t = ((key: string, vars?: Record<string, string | number>) => {
    const hit = dicts.find((d) => d.dict[key] !== undefined);
    return hit ? formatMessage(hit.dict[key], hit.code, vars, compiled, `${hit.code}\0${key}`) : key;
  }) as Translator;
  t.locale = site.locale;
  return t;
});

/** Chuỗi đã chọn đúng ngôn ngữ để truyền xuống trình duyệt (<TranslationsProvider>). */
export interface ClientMessages { locale: string; messages: Record<string, { code: string; text: string }> }

/**
 * Lấy các chuỗi cần cho component client (core ≥ 1.20.0) — chỉ khoá bắt đầu bằng một trong <paramref name="prefixes"/>
 * (vd ["cart.", "auth."]) để không gửi cả từ điển xuống trình duyệt. Truyền kết quả vào <TranslationsProvider value={…}>.
 */
export async function getClientMessages(prefixes: string[]): Promise<ClientMessages> {
  const { site, dicts } = await getDicts();
  const messages: ClientMessages["messages"] = {};
  for (const d of dicts)
    for (const [key, text] of Object.entries(d.dict))
      if (!(key in messages) && prefixes.some((p) => key.startsWith(p))) messages[key] = { code: d.code, text };
  return { locale: site.locale, messages };
}
