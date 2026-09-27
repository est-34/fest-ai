"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPublicFestival } from "@/shared/lib/public-festival";
import { usePublicFestivalLoader } from "@/shared/lib/use-public-festival";
import { LOCALES, LANGUAGE_BY_LOCALE, type Locale } from "./locale";

/** 축제별 지원 언어 설정(AI-05). 자동 전환·언어 선택 화면이 이 목록만 쓴다. */
export async function fetchFestivalLanguages(load = fetchPublicFestival): Promise<{ supported: Locale[]; default: Locale }> {
  const festival = await load();
  const supported = festival.supportedLanguages.filter((language): language is Locale => language in LANGUAGE_BY_LOCALE);
  const fallback = (festival.defaultLanguage in LANGUAGE_BY_LOCALE ? festival.defaultLanguage : "ko") as Locale;
  return { supported: supported.length ? supported : [fallback], default: fallback };
}

/**
 * 축제별 지원 언어(AI-05). 조회 전·실패 시에는 화면에서 언어 선택이 사라지지 않도록
 * 번역이 준비된 전체 언어를 쓴다.
 */
export function useFestivalLanguages() {
  const loadFestival = usePublicFestivalLoader(Infinity);
  const { data } = useQuery({ queryKey: ["festival-languages"], queryFn: () => fetchFestivalLanguages(loadFestival), staleTime: Infinity });
  return { languages: data?.supported ?? LOCALES, defaultLanguage: data?.default ?? "ko" };
}
