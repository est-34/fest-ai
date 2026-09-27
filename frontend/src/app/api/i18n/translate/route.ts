import { NextResponse } from "next/server";
import { translateEntries } from "@/shared/lib/i18n/server/translate";
import { LOCALES, type Locale } from "@/shared/lib/i18n/locale";

// 이 라우트는 유료 API(Google Translate)를 호출한다. 인증이 없으므로 무제한으로 열어 두면
// 누구나 임의의 텍스트를 밀어넣어 과금을 태울 수 있는 오픈 프록시가 된다.
// 방문객 화면이 실제로 보내는 크기(항목 수·길이)를 넘는 요청은 받지 않는다.
const MAX_ENTRIES = 120;
const MAX_TEXT_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 20_000;

// 분당 IP별 요청 수. 인스턴스 로컬이라 여러 인스턴스로 늘리면 Redis 등으로 옮겨야 한다.
const RATE_LIMIT_PER_MINUTE = 30;
const hits = new Map<string, number>();

function overRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${Math.floor(Date.now() / 60_000)}`;
  const count = (hits.get(key) ?? 0) + 1;
  hits.set(key, count);
  // 지난 창(window)의 키는 버린다 — 맵이 무한히 커지지 않게.
  if (hits.size > 5_000) {
    const current = `:${Math.floor(Date.now() / 60_000)}`;
    for (const existing of hits.keys()) if (!existing.endsWith(current)) hits.delete(existing);
  }
  return count > RATE_LIMIT_PER_MINUTE;
}

function tooLarge(entries: Record<string, string>) {
  const values = Object.values(entries);
  if (values.length > MAX_ENTRIES) return true;
  if (values.some((value) => typeof value !== "string" || value.length > MAX_TEXT_LENGTH)) return true;
  return values.reduce((total, value) => total + value.length, 0) > MAX_TOTAL_LENGTH;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { locale?: string; entries?: Record<string, string> }
    | null;

  if (!body || !LOCALES.includes(body.locale as Locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  if (!body.entries || typeof body.entries !== "object" || Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Invalid entries" }, { status: 400 });
  }
  if (tooLarge(body.entries)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (overRateLimit(request)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const entries = await translateEntries(body.entries, body.locale as Locale);
    return NextResponse.json({ entries, degraded: false });
  } catch (error) {
    console.error("Translation failed:", error);
    // Fail open: 원문(한국어)을 돌려줘 화면은 계속 뜨게 하되, 번역이 아니라는 사실을
    // degraded로 알린다. 예전에는 조용히 한국어를 주기만 해서, 키를 설정하지 않은 배포에서
    // 외국어 방문객이 이유도 모른 채 한국어를 보고 있었다.
    return NextResponse.json({ entries: body.entries, degraded: true });
  }
}
