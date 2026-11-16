// Entry chính chỉ chạy ở server (Server Component, route, generateMetadata). File "use client" import từ ".../client";
// import nhầm thì Next báo lỗi lúc build thay vì kéo phần server (cookie, gọi API) vào bundle trình duyệt.
import "server-only";

export * from "./types";
export {
  pluginFetch, cmsFetch, CmsApiError, type FetchOptions, getSite,
  getPosts, getPostIds, getAdjacentPost, getFacets, getPost, getPostById, getPattern,
  getTerms, queryTerms, getAuthors, getMedia, getMenu, getMenuById, getWidgets, getComments, requestUnlock, getArchives, getLanguages,
  type PostQuery, type TaxQueryClause, type MetaQuery, type MetaQueryClause, type ListPage, type FacetValue, type FacetResult,
  type TermQuery, type AuthorQuery, type MediaQuery, type CommentQuery,
} from "./api";
export { formatDate, setting, pageLink, pageLinkWithQuery, cx } from "./utils";
export * from "./conditions";
export { definePlugin, getPlugin, hasPlugin, applyFilters, doAction, BUILTIN_PAGE_TEMPLATES } from "./runtime";
export { PostContent, EditableRegion } from "./content";
export { Img, imageCandidates, type ImgProps } from "./image";
export { Menu, WidgetArea, Slot, SearchForm, Pagination, FeaturedImage, PostDate, TermLinks, Comments, LanguageSwitcher } from "./components";
export { getT, getClientMessages, BUILTIN as BUILTIN_STRINGS, type Translator, type ClientMessages } from "./i18n";
export { getRequestLocale, localeHref, LOCALE_HEADER } from "./locale";
export { CommentForm, CommentList, CommentsMore, ExtensionBoundary, PostPasswordForm, Link, NavToggle, isInternalHref, type LinkProps } from "./client";
export { getPreference } from "./preferences";
export { CONSENT_CATEGORIES, CONSENT_META, type ConsentCategory } from "./consent";
export { consentDefault } from "./consent-server";
export { getCurrentUser, requireUser, userCan, safeRedirect, type CurrentUser } from "./auth";
export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, LogoutButton, LoginOutLink, useCurrentUser, ProfileForm, ChangePasswordForm, DeleteAccountForm, AUTH_LABELS, AUTH_PATHS, type AuthLabels, type AuthPaths, type SignInProvider } from "./auth-forms";
export { buildDocumentMetadata } from "./metadata";

/** Lấy giá trị Customizer của theme đang active. */
export async function getThemeSettings() {
  const { getSite } = await import("./api");
  return (await getSite()).themeSettings;
}
export { PluginForm } from "./plugin-form";
export type { PluginFormField } from "./plugin-form-client";
export { defineBlock, type BlockDefinition, type BlockDefinitionInput, type BlockAttrSpec } from "@ecomcx/ecomweb-content";
export { BINDABLE, CORE_BINDING_SOURCES, type BindingContext, type BindingSource } from "./bindings";
