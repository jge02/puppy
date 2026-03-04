"use client";

import {
  createContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLocale,
  localeStorageKey,
  locales,
  type Locale,
} from "./config";
import { messages, type MessageKey } from "./messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
};

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    if (storedLocale && isLocale(storedLocale)) {
      setLocaleState(storedLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    setLocale: setLocaleState,
    t: (key) => messages[locale][key] ?? messages[defaultLocale][key] ?? key,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
