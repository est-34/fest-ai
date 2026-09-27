"use client";

import { useQuery } from "@tanstack/react-query";
import { translateEntries } from "./translate-client";
import type { Locale } from "./locale";

/**
 * Auto-translates a flat { key: koreanText } map for the given locale.
 * Use this for LIVE admin-authored content (notices, reservation calls, ...)
 * rendered directly in a component — entries data-layer getters call
 * translateEntries directly instead (see entities/*.ts).
 *
 * Falls back to the original (Korean) entries while loading or on error, so
 * the UI never shows blank content.
 */
export function useAutoTranslate(entries: Record<string, string>, locale: Locale) {
  const keys = Object.keys(entries).sort();
  const cacheKey = keys.map((key) => `${key}=${entries[key]}`).join("|");

  const { data, isLoading } = useQuery({
    queryKey: ["auto-translate", locale, cacheKey] as const,
    queryFn: () => translateEntries(entries, locale),
    staleTime: Infinity,
    enabled: keys.length > 0,
  });

  return { translated: data ?? entries, isLoading };
}
