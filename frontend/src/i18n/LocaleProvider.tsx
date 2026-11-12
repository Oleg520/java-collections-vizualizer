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
  type Translator,
  type Params,
} from "./locale";
import type { MessageKey } from "./catalog";
const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
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
      t: (key: MessageKey, params?: Params) => translate(locale, key, params),
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
export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switch" role="group" aria-label={t("language")}>
      {(["ru", "en"] as const).map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-label={language === "ru" ? "Русский" : "English"}
          aria-pressed={locale === language}
          onClick={() => setLocale(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
