import { getCurrentUser } from "./auth";
import { ForgotPasswordForm, LoginForm, LogoutButton, RegisterForm, ResetPasswordForm, type AuthLabels, type AuthPaths } from "./auth-forms";
import { Slot } from "./components";
import { getT } from "./i18n";
import { localeHref } from "./locale";
import type { TemplateProps } from "./types";

/**
 * Template mặc định cho /login, /register, /forgot-password, /reset-password khi theme không có template
 * "login" | "register" | "forgot-password" | "reset-password" hoặc "auth". Hiển thị trong layout của theme.
 */
export default async function AuthPage({ data, site }: TemplateProps) {
  const t = await getT();
  const name = data.route?.name ?? "login";
  const L = Object.fromEntries(Object.keys(LABEL_KEYS).map((k) => [k, t(LABEL_KEYS[k as keyof AuthLabels])])) as Partial<AuthLabels>;
  const user = name === "login" || name === "register" ? await getCurrentUser() : null;
  // Đường dẫn theo ngôn ngữ đang xem (/en/login…)
  const paths: AuthPaths = {
    login: localeHref(site, "/login"), register: localeHref(site, "/register"),
    forgotPassword: localeHref(site, "/forgot-password"), home: localeHref(site, "/"),
  };

  return (
    <main className="auth-page">
      <h1>{data.title}</h1>
      {user ? (
        <p className="auth-signed-in">
          {t("auth.signedInAs", { name: user.displayName })} <LogoutButton redirectTo={paths.home}>{L.logout}</LogoutButton>
        </p>
      ) : name === "register" ? <RegisterForm labels={L} paths={paths} fields={<Slot name="auth.register.fields" />} />
        : name === "forgot-password" ? <ForgotPasswordForm labels={L} paths={paths} fields={<Slot name="auth.forgot_password.fields" />} />
        : name === "reset-password" ? <ResetPasswordForm labels={L} paths={paths} />
        : <LoginForm labels={L} paths={paths} fields={<Slot name="auth.login.fields" />} />}
    </main>
  );
}

/** Khoá dịch (locales/*.json của theme ghi đè được) cho từng nhãn của form. */
const LABEL_KEYS: Record<keyof AuthLabels, string> = {
  login: "auth.login", password: "auth.password", submitLogin: "auth.submitLogin", code: "auth.code", verify: "auth.verify",
  userName: "auth.userName", email: "auth.email", displayName: "auth.displayName", submitRegister: "auth.submitRegister",
  submitForgot: "auth.submitForgot", newPassword: "auth.newPassword", submitReset: "auth.submitReset", sending: "auth.sending",
  error: "auth.error", logout: "auth.logout", noAccount: "auth.noAccount", register: "auth.register", forgot: "auth.forgot",
  haveAccount: "auth.haveAccount", login2: "auth.login2", registerClosed: "auth.registerClosed", missingToken: "auth.missingToken",
  bio: "auth.bio", currentPassword: "auth.currentPassword", currentPasswordForEmail: "auth.currentPasswordForEmail", submitProfile: "auth.submitProfile",
  submitPassword: "auth.submitPassword", notSignedIn: "auth.notSignedIn", deleteWarning: "auth.deleteWarning", deleteConfirm: "auth.deleteConfirm",
  submitDelete: "auth.submitDelete",
};
