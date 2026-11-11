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
export function translate(locale: Locale, key: MessageKey): string {
  return (locale === "en" ? en : ru)[key];
}
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
