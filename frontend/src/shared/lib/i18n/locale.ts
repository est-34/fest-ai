/** 언어 선택 버튼과 운영 대시보드 언어별 이용 로그에 그대로 노출되는 표시 이름. */
export const LANGUAGE_BY_LOCALE = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  ja: "日本語",
} as const;

export type Locale = keyof typeof LANGUAGE_BY_LOCALE;
export const LOCALES = Object.keys(LANGUAGE_BY_LOCALE) as Locale[];

export const BCP47_BY_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
  zh: "zh-CN",
  ja: "ja-JP",
};
