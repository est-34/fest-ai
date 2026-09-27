import type { ChatMessage } from "@/entities/visitor";
import { ApiError, FESTIVAL_CODE, json, visitorApi, visitorSessionGeneration } from "@/shared/lib/api";
import { BCP47_BY_LOCALE, type Locale } from "@/shared/lib/i18n";
import { readJson, writeJson } from "@/shared/lib/local-store";
import { translateEntries } from "@/shared/lib/i18n/translate-client";

// 대화 ID는 새로고침해도 살아남아야 한다 — 메모리에만 두면 화면을 다시 열 때마다 새
// 대화가 열려서, 서버에 남아 있는 이전 대화 내용을 다시 볼 방법이 없었다.
const CONVERSATION_KEY = "festai-ai-conversation";

let conversationId: string | undefined;
let conversationLocale: Locale | undefined;
let conversationSession: number | undefined;

function restore() {
  return readJson<{ id: string; locale: Locale } | undefined>(CONVERSATION_KEY, undefined);
}

// 저장 공간이 없어도 대화 자체는 이어진다 — 새로고침 시 복원만 안 될 뿐이다(writeJson이 삼킨다).
function remember(id: string, locale: Locale) {
  writeJson(CONVERSATION_KEY, { id, locale });
}

async function openConversation(locale: Locale) {
  // 대화 세션은 생성 시점의 언어로 고정되고 방문자 세션에 매여 있다.
  // 언어가 바뀌거나 방문자 세션이 재발급되면 이전 대화는 못 쓰므로 새로 연다.
  if (conversationLocale !== locale || conversationSession !== visitorSessionGeneration()) resetConversation();
  if (!conversationId) {
    const stored = restore();
    if (stored?.locale === locale) {
      conversationId = stored.id;
    } else {
      conversationId = (await visitorApi<{ id: string }>("/visitor/ai/conversations", json("POST", { festivalCode: FESTIVAL_CODE, language: locale }))).id;
      remember(conversationId, locale);
    }
    conversationLocale = locale;
    // 생성 요청 중에 세션이 갱신됐을 수 있으므로 응답 이후 값을 기록한다.
    conversationSession = visitorSessionGeneration();
  }
  return conversationId;
}

interface HistoryRow {
  id: string;
  question: string;
  answer: string;
  freshnessAt?: string | null;
  fallback?: unknown;
  sources: Array<{ contentVersionId: string }>;
}

/**
 * 이전 대화 복원. 서버에 남아 있는 기록을 화면이 한 번도 읽지 않아서, 새로고침하면
 * 대화가 통째로 사라진 것처럼 보였다.
 */
export async function loadHistory(locale: Locale): Promise<Array<{ role: "user" | "assistant"; content: string; rawContent?: string; messageId: string; freshnessAt?: string; needsFallbackChannel: boolean }>> {
  const stored = restore();
  if (!stored || stored.locale !== locale) return [];
  try {
    const rows = await visitorApi<HistoryRow[]>(`/visitor/ai/conversations/${stored.id}/messages`);
    conversationId = stored.id;
    conversationLocale = locale;
    conversationSession = visitorSessionGeneration();
    return await Promise.all(rows.flatMap((row) => {
      const needsFallbackChannel = Boolean(row.fallback) || row.sources.length === 0;
      return [
        Promise.resolve({ role: "user" as const, content: row.question, messageId: `${row.id}-q`, needsFallbackChannel: false }),
        (async () => ({
          role: "assistant" as const,
          content: needsFallbackChannel ? await translateFallbackAnswer(row.answer, locale) : row.answer,
          rawContent: needsFallbackChannel ? row.answer : undefined,
          messageId: row.id,
          freshnessAt: row.freshnessAt ?? undefined,
          needsFallbackChannel,
        }))(),
      ];
    }));
  } catch {
    // 세션이 만료됐거나 대화가 사라졌으면 빈 화면으로 시작한다.
    resetConversation();
    return [];
  }
}

function sendMessage(id: string, question: string) {
  return visitorApi<{
    messageId: string;
    answer: string;
    sources: Array<{ title: string }>;
    // 답변이 어느 시점 데이터로 만들어졌는지. 서버가 안 내려주면 표시하지 않는다.
    freshnessAt?: string | null;
    // 검증된 근거로 답하지 못했을 때 서버가 채워 보내는 값.
    fallback?: { reason?: string } | null;
  }>(`/visitor/ai/conversations/${id}/messages`, json("POST", { message: question, context: { channel: "PERSO_AI", inputMode: "VOICE_OR_TEXT" } }));
}

async function translateSourceTitles(titles: string[], locale: Locale): Promise<string[]> {
  if (locale === "ko" || titles.length === 0) return titles;
  const entries = Object.fromEntries(titles.map((title, index) => [String(index), title]));
  const translated = await translateEntries(entries, locale);
  return titles.map((title, index) => translated[String(index)] ?? title);
}

/**
 * 근거 부족(INSUFFICIENT_GROUNDING) 등으로 안내가 막히면 서버는 요청 언어와 무관하게
 * 고정된 한국어 문구("승인된 축제 정보에서 충분한 근거를 찾지 못했습니다." 등)를 그대로 내려준다.
 * 근거를 찾아 실제로 생성된 답변은 서버가 이미 요청 언어로 답하므로 여기서는 건드리지 않는다.
 */
async function translateFallbackAnswer(answer: string, locale: Locale): Promise<string> {
  if (locale === "ko") return answer;
  const translated = await translateEntries({ answer }, locale);
  return translated.answer ?? answer;
}

export async function generateReply(question: string, locale: Locale) {
  let response;
  try {
    response = await sendMessage(await openConversation(locale), question);
  } catch (error) {
    // 서버에 없는 대화(404)는 새 대화로 한 번만 복구한다 — 무한 재시도는 하지 않는다.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    resetConversation();
    response = await sendMessage(await openConversation(locale), question);
  }

  // 근거(출처)가 하나도 없거나 서버가 fallback을 표시하면 AI 답변만으로는 부족하다 —
  // 이때는 안내데스크·전화 같은 사람이 응대하는 채널을 함께 안내한다.
  const needsFallbackChannel = Boolean(response.fallback) || response.sources.length === 0;

  return {
    content: needsFallbackChannel ? await translateFallbackAnswer(response.answer, locale) : response.answer,
    rawContent: needsFallbackChannel ? response.answer : undefined,
    sources: await translateSourceTitles(response.sources.map((source) => source.title), locale),
    messageId: response.messageId,
    freshnessAt: response.freshnessAt ?? undefined,
    needsFallbackChannel,
  };
}

export function resetConversation() {
  conversationId = undefined;
  conversationLocale = undefined;
  conversationSession = undefined;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(CONVERSATION_KEY);
    } catch {
      // 지우지 못해도 위 메모리 상태가 이미 비었으므로 새 대화가 열린다.
    }
  }
}

export function reportAiMessage(messageId: string) {
  return visitorApi(`/visitor/ai/messages/${messageId}/reports`, json("POST", { reason: "INCORRECT_OR_UNSAFE", detail: "방문객 AI 화면에서 답변 오류 신고" }));
}

export function buildMessage(
  role: ChatMessage["role"],
  content: string,
  locale: Locale,
  extra: {
    sources?: string[];
    backendMessageId?: string;
    freshnessAt?: string;
    needsFallbackChannel?: boolean;
    rawContent?: string;
  } = {},
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString(BCP47_BY_LOCALE[locale], { hour: "2-digit", minute: "2-digit" }),
    ...extra,
  };
}
