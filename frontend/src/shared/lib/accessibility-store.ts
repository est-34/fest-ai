"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { json, visitorApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n/locale";

export type VisitorAccessMode = "qr" | "kiosk";
/** 축제 기본값 그대로인지, 방문객이 직접 골랐는지, 첫 발화로 자동 전환됐는지(AI-05 언어별 이용 로그). */
export type LanguageSource = "DEFAULT" | "MANUAL" | "AUTO";

interface AccessibilityState {
  language: Locale;
  languageSource: LanguageSource;
  largeText: boolean;
  highContrast: boolean;
  voiceGuide: boolean;
  visitorMode: VisitorAccessMode;
  setLanguage: (language: Locale, source?: LanguageSource) => void;
  setVisitorMode: (visitorMode: VisitorAccessMode) => void;
  toggleLargeText: () => void;
  toggleHighContrast: () => void;
  toggleVoiceGuide: () => void;
}

// 서버 세션에도 반영해야 AI 응답·안내 언어가 방문객이 고른 설정을 따른다.
// 이용 방식(키오스크/QR)과 언어 전환 방식도 함께 올린다 — 운영 대시보드의 언어별 이용 로그가 이 값으로 집계된다.
// ponytail: 저장된 설정은 값을 바꿀 때만 올린다. 재방문으로 새 세션이 발급되면 서버는 축제 기본 언어로 시작한다.
function syncVisitorSession(state: AccessibilityState) {
  visitorApi("/visitor-sessions/current", json("PATCH", {
    language: state.language,
    accessibilityPreferences: {
      largeText: state.largeText,
      highContrast: state.highContrast,
      voiceGuide: state.voiceGuide,
      visitorMode: state.visitorMode,
      languageSource: state.languageSource,
    },
  })).catch(() => {
    // 화면 설정은 로컬에 이미 반영됐으므로 동기화 실패로 사용자를 막지 않는다.
  });
}

type Patch = Partial<AccessibilityState> | ((state: AccessibilityState) => Partial<AccessibilityState>);

// v0은 language를 "한국어" 같은 표시 이름으로 저장했다. 접근성 설정까지 같이 날아가지 않도록 코드로 옮긴다.
const LEGACY_LOCALE: Record<string, Locale> = { 한국어: "ko", English: "en", 中文: "zh", 日本語: "ja" };

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set, get) => {
      // 값을 바꾼 뒤 서버 세션에 올린다. persist 복원은 이 경로를 타지 않으므로 그대로 조용하다.
      const sync = (patch: Patch) => {
        set(patch);
        syncVisitorSession(get());
      };
      return {
        language: "ko",
        languageSource: "DEFAULT",
        largeText: false,
        highContrast: false,
        voiceGuide: false,
        visitorMode: "qr",
        setLanguage: (language, source = "MANUAL") => sync({ language, languageSource: source }),
        setVisitorMode: (visitorMode) => sync({ visitorMode }),
        toggleLargeText: () => sync((state) => ({ largeText: !state.largeText })),
        toggleHighContrast: () => sync((state) => ({ highContrast: !state.highContrast })),
        toggleVoiceGuide: () => sync((state) => ({ voiceGuide: !state.voiceGuide })),
      };
    },
    {
      name: "festai-accessibility",
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as AccessibilityState;
        if (version >= 1) return state;
        return { ...state, language: LEGACY_LOCALE[state.language as string] ?? "ko" };
      },
    },
  ),
);
