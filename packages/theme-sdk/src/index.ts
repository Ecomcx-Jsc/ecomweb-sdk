export * from "./types";
export * from "./api";
export * from "./utils";
export { definePlugin, getPlugin, hasPlugin, applyFilters, doAction, getSlotItems, getSlotComponents, getActiveTheme, getActiveExtensions, BUILTIN_PAGE_TEMPLATES, findShortcode, findWidget, findBlock, findRoute, findRegion } from "./runtime";
export { PostContent, EditableRegion } from "./content";
export { Img, imageCandidates, type ImgProps } from "./image";
export { Menu, WidgetArea, Slot, SearchForm, Pagination, FeaturedImage, PostDate, TermLinks, Comments, LanguageSwitcher } from "./components";
export { getT, getClientMessages, BUILTIN as BUILTIN_STRINGS, type Translator, type ClientMessages } from "./i18n";
export { getRequestLocale, localeHref, LOCALE_HEADER } from "./locale";
export { CommentForm, CommentList, CommentsMore, ExtensionBoundary, PostPasswordForm, Link, isInternalHref, type LinkProps } from "./client";
export { getPreference } from "./preferences";
export { getCurrentUser, getAccessToken, requireUser, userCan, safeRedirect, ACCESS_COOKIE, REFRESH_COOKIE, type CurrentUser } from "./auth";
export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, LogoutButton, useCurrentUser, ProfileForm, ChangePasswordForm, DeleteAccountForm, AUTH_LABELS, AUTH_PATHS, type AuthLabels, type AuthPaths, type SignInProvider } from "./auth-forms";
export { buildDocumentMetadata } from "./metadata";

/** Lấy giá trị Customizer của theme đang active. */
export async function getThemeSettings() {
  const { getSite } = await import("./api");
  return (await getSite()).themeSettings;
}
export { PluginForm } from "./plugin-form";
export type { PluginFormField } from "./plugin-form-client";
export { defineBlock, type BlockDefinition, type BlockDefinitionInput, type BlockAttrSpec } from "@ecomcx/ecomweb-content";
