"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UI_STRINGS, UI_LOCALES, type UiLocale, type UiStrings } from "@/lib/lexlens/ui-i18n";

interface LangCtx {
  locale: UiLocale;
  setLocale: (l: UiLocale) => void;
  t: UiStrings;
}

const Ctx = createContext<LangCtx>({
  locale: "en",
  setLocale: () => {},
  t: UI_STRINGS.en,
});

const STORAGE_KEY = "lexlens.ui.locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>("en");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY) as UiLocale | null;
        if (saved && UI_LOCALES.includes(saved)) setLocaleState(saved);
      } catch {
        /* private mode — keep default */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const setLocale = useCallback((l: UiLocale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <Ctx.Provider value={{ locale, setLocale, t: UI_STRINGS[locale] }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
