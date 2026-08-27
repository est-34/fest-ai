"use client";

import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { ko } from "./dictionaries/ko";
import { en } from "./dictionaries/en";
import { zh } from "./dictionaries/zh";
import { ja } from "./dictionaries/ja";
import { BCP47_BY_LOCALE, type Locale } from "./locale";

export type { Locale } from "./locale";
export { LANGUAGE_BY_LOCALE, BCP47_BY_LOCALE } from "./locale";
export { detectLocale } from "./detect-locale";
export { useAutoTranslate } from "./use-auto-translate";

export type Dictionary = typeof ko;

export const dictionaries: Record<Locale, Dictionary> = { ko, en, zh, ja };

export function useTranslation() {
  const locale = useAccessibilityStore((state) => state.language);
  return { t: dictionaries[locale], locale, bcp47: BCP47_BY_LOCALE[locale] };
}
