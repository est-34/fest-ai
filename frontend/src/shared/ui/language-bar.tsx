"use client";

import { useSyncExternalStore } from "react";
import { LANGUAGE_BY_LOCALE, useTranslation } from "@/shared/lib/i18n";
import { isTranslationDegraded, subscribeTranslationState } from "@/shared/lib/i18n/translate-client";
import { cn } from "@/shared/lib/utils";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { useFestivalLanguages } from "@/shared/lib/i18n/festival-languages";

/** 축제가 지원하는 언어 버튼. 접근성 시트와 키오스크 진입 화면이 같은 목록을 쓴다(AI-05). */
export function LanguageBar({ className, buttonClassName }: { className?: string; buttonClassName?: string }) {
  const { languages } = useFestivalLanguages();
  const { t } = useTranslation();
  const language = useAccessibilityStore((state) => state.language);
  const setLanguage = useAccessibilityStore((state) => state.setLanguage);
  // 서버 렌더링 시점에는 번역을 시도한 적이 없으므로 항상 정상으로 본다.
  const degraded = useSyncExternalStore(subscribeTranslationState, isTranslationDegraded, () => false);

  return (
    <div className={cn("space-y-2", className)}>
      {/* 번역에 실패하면 원문(한국어)이 그대로 나간다 — 조용히 두면 외국어 방문객은
          왜 한국어가 보이는지 알 수 없다. */}
      {degraded && language !== "ko" && (
        <p className="rounded-lg bg-muted px-2 py-1.5 text-[0.6875rem] text-muted-foreground" role="status">
          {t.common.translationUnavailable}
        </p>
      )}
      <div
        role="group"
        aria-label={t.accessibility.languageLabel}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${languages.length}, minmax(0, 1fr))` }}
      >
        {languages.map((locale) => (
          <button
            type="button"
            key={locale}
            lang={locale}
            aria-pressed={language === locale}
            onClick={() => setLanguage(locale)}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              language === locale
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent",
              buttonClassName,
            )}
          >
            {LANGUAGE_BY_LOCALE[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
