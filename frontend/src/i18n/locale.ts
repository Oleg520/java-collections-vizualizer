import { en, ru, type MessageKey } from "./catalog";
export type Locale = "ru" | "en";
export const localeStorageKey = "jcv.locale";
export function readLocale(
  storage: Pick<Storage, "getItem"> | undefined,
): Locale {
  try {
    return storage?.getItem(localeStorageKey) === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}
export function saveLocale(
  storage: Pick<Storage, "setItem"> | undefined,
  locale: Locale,
) {
  try {
    storage?.setItem(localeStorageKey, locale);
  } catch {
    /* In-memory selection still works. */
  }
}
export type Params = Record<string, unknown>;
export type Translator = (key: MessageKey, params?: Params) => string;
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Params = {},
): string {
  const catalog = locale === "en" ? en : ru;
  const pluralKey =
    typeof params.count === "number"
      ? `${key}.${new Intl.PluralRules(locale).select(params.count)}`
      : "";
  const template = Object.hasOwn(catalog, pluralKey)
    ? catalog[pluralKey as MessageKey]
    : catalog[key];
  if (typeof template !== "string")
    return locale === "en" ? "Translation unavailable" : "Перевод недоступен";
  return template.replace(/\{(\w+)\}/g, (_token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : "—",
  );
}
export const russian: Translator = (key, params) =>
  translate("ru", key, params);
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
