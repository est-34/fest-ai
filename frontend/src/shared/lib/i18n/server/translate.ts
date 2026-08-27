import { createHash } from "node:crypto";
import type { Locale } from "../locale";

// Google Cloud Translation API (Basic/v2) language codes.
const GOOGLE_LANGUAGE_CODE: Record<Locale, string> = {
  ko: "ko",
  en: "en",
  zh: "zh-CN",
  ja: "ja",
};

function hashEntries(entries: Record<string, string>) {
  const sorted = Object.keys(entries)
    .sort()
    .map((key) => `${key}=${entries[key]}`)
    .join("\n");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 24);
}

// In-memory fallback used whenever Vercel Runtime Cache isn't available
// (e.g. local `next dev`, or a region without the cache provisioned).
const memoryCache = new Map<string, Record<string, string>>();

async function readCache(key: string): Promise<Record<string, string> | undefined> {
  try {
    const { getCache } = await import("@vercel/functions");
    const cached = await getCache().get(key);
    if (cached) return cached as Record<string, string>;
  } catch {
    // Runtime Cache unavailable in this context — fall through to memory cache.
  }
  return memoryCache.get(key);
}

async function writeCache(key: string, locale: Locale, value: Record<string, string>) {
  memoryCache.set(key, value);
  try {
    const { getCache } = await import("@vercel/functions");
    await getCache().set(key, value, {
      ttl: 60 * 60 * 24 * 7,
      tags: [`i18n-${locale}`],
      name: "i18n-translation",
    });
  } catch {
    // Runtime Cache unavailable — memory cache above is the fallback.
  }
}

interface GoogleTranslateResponse {
  data: { translations: Array<{ translatedText: string }> };
}

async function callGoogleTranslate(texts: string[], locale: Locale): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texts,
      source: "ko",
      target: GOOGLE_LANGUAGE_CODE[locale],
      format: "text",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Translate API error (${res.status}): ${body}`);
  }

  const body = (await res.json()) as GoogleTranslateResponse;
  return body.data.translations.map((t) => t.translatedText);
}

/**
 * Translates a flat map of { key: koreanText } into the target locale using
 * Google Cloud Translation, caching results by (locale, content hash) so
 * identical admin-authored content is only ever translated once.
 */
export async function translateEntries(
  entries: Record<string, string>,
  locale: Locale,
): Promise<Record<string, string>> {
  if (locale === "ko") return entries;
  const keys = Object.keys(entries);
  if (keys.length === 0) return entries;

  const cacheKey = `i18n:${locale}:${hashEntries(entries)}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  const texts = keys.map((key) => entries[key]);
  const translatedTexts = await callGoogleTranslate(texts, locale);
  const output = Object.fromEntries(keys.map((key, index) => [key, translatedTexts[index] ?? entries[key]]));

  await writeCache(cacheKey, locale, output);
  return output;
}
