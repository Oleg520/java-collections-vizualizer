import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  browserStorage,
  readLocale,
  saveLocale,
  translate,
  type Locale,
} from "./locale";
import type { MessageKey } from "./catalog";
const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
} | null>(null);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, selectLocale] = useState<Locale>(() =>
    readLocale(browserStorage()),
  );
  const value = useMemo(
    () => ({
      locale,
      setLocale(next: Locale) {
        selectLocale(next);
        saveLocale(browserStorage(), next);
      },
      t: (key: MessageKey) => translate(locale, key),
    }),
    [locale],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translate(locale, "description"));
  }, [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error("LocaleProvider is required");
  return value;
}
export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      className="language-select"
      aria-label={t("language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value === "en" ? "en" : "ru")}
    >
      <option value="ru" lang="ru" label="RU">
        Русский
      </option>
      <option value="en" lang="en" label="EN">
        English
      </option>
    </select>
  );
}
