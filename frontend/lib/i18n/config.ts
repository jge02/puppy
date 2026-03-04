export const locales = ["zh-CN", "en", "zh-TW", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-CN";
export const localeStorageKey = "puppy_locale";

export const localeLabels: Record<Locale, Record<Locale, string>> = {
  "zh-CN": {
    "zh-CN": "简体中文",
    en: "英语",
    "zh-TW": "繁體中文",
    fr: "法语",
  },
  en: {
    "zh-CN": "Simplified Chinese",
    en: "English",
    "zh-TW": "Traditional Chinese",
    fr: "French",
  },
  "zh-TW": {
    "zh-CN": "簡體中文",
    en: "英語",
    "zh-TW": "繁體中文",
    fr: "法語",
  },
  fr: {
    "zh-CN": "Chinois simplifie",
    en: "Anglais",
    "zh-TW": "Chinois traditionnel",
    fr: "Francais",
  },
};
