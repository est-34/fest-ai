"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dictionaries, useTranslation, type Locale } from "@/shared/lib/i18n";
import { translateEntries } from "@/shared/lib/i18n/translate-client";
import { buildMessage, generateReply, loadHistory, reportAiMessage, resetConversation } from "../lib/generate-reply";
import { useChatStore, WELCOME_MESSAGE_ID } from "./chat-store";

export type ReportStatus = "idle" | "pending" | "done" | "error";

/** AI 안내 대화의 상태와 부수효과(복원·재번역·질문·신고)를 모은다. 화면은 그리기만 한다. */
export function useAiChat(locale: Locale) {
  const { t } = useTranslation();
  const { messages, isTyping, addMessage, setTyping, reset, syncWelcome, restoreMessages, updateMessageContents } = useChatStore();
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");

  const welcomeMessage = useMemo(
    () => ({
      id: WELCOME_MESSAGE_ID,
      role: "assistant" as const,
      content: t.aiGuide.welcomeContent,
      timestamp: t.aiGuide.welcomeTimestamp,
      sources: [t.aiGuide.welcomeSource],
    }),
    [t],
  );

  useEffect(() => {
    syncWelcome(welcomeMessage);
  }, [welcomeMessage, syncWelcome]);

  // 새로고침하면 대화가 사라진 것처럼 보였다 — 서버에 남아 있는 이전 대화를 한 번 복원한다.
  // 이미 대화가 오갔으면(환영 문구 외에 메시지가 있으면) 건드리지 않는다.
  useEffect(() => {
    let cancelled = false;
    if (messages.some((message) => message.id !== WELCOME_MESSAGE_ID)) return;
    loadHistory(locale).then((history) => {
      if (cancelled || history.length === 0) return;
      restoreMessages([
        welcomeMessage,
        ...history.map((entry) => buildMessage(entry.role, entry.content, locale, {
          backendMessageId: entry.role === "assistant" ? entry.messageId : undefined,
          freshnessAt: entry.freshnessAt,
          needsFallbackChannel: entry.needsFallbackChannel,
          rawContent: entry.rawContent,
        })),
      ]);
    });
    return () => { cancelled = true; };
    // 최초 진입과 언어 전환 때만 복원한다. messages를 의존성에 넣으면 매 메시지마다 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, welcomeMessage]);

  // 근거 부족 등으로 뜬 고정 안내 문구(rawContent 보유)는 대화 도중 언어를 바꿔도 화면에
  // 그대로 남아 있었다 — 원문(한국어)을 들고 있다가 언어가 바뀔 때마다 다시 번역해 갈아 끼운다.
  useEffect(() => {
    const fallbackMessages = messages.filter((message) => message.needsFallbackChannel && message.rawContent);
    if (fallbackMessages.length === 0) return;
    let cancelled = false;
    translateEntries(
      Object.fromEntries(fallbackMessages.map((message) => [message.id, message.rawContent!])),
      locale,
    ).then((translated) => {
      if (!cancelled) updateMessageContents(translated);
    });
    return () => { cancelled = true; };
    // rawContent 보유 메시지 집합이 바뀔 때(새 fallback 추가)도 다시 맞추되, 무한 루프를
    // 피하려고 messages 전체가 아니라 locale에만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const latestAssistantMessage = messages.findLast((message) => message.role === "assistant");

  // 자동 전환된 언어로 바로 답해야 해서 사용할 언어를 인자로 받는다(전환 직후 locale은 아직 이전 값).
  const ask = useCallback(async (question: string, askLocale: Locale = locale) => {
    if (isTyping) return;

    addMessage(buildMessage("user", question, askLocale));
    setTyping(true);
    setReportStatus("idle");

    try {
      const reply = await generateReply(question, askLocale);
      addMessage(buildMessage("assistant", reply.content, askLocale, {
        sources: reply.sources,
        backendMessageId: reply.messageId,
        freshnessAt: reply.freshnessAt,
        needsFallbackChannel: reply.needsFallbackChannel,
        rawContent: reply.rawContent,
      }));
    } catch {
      // 답변 자체를 받지 못한 경우도 근거가 없는 상황이라 대체 채널을 함께 안내한다.
      // 자동 전환 직후에는 t가 아직 이전 언어라 실패 안내도 물어본 언어로 맞춘다.
      addMessage(buildMessage("assistant", dictionaries[askLocale].aiGuide.replyFailed, askLocale, { needsFallbackChannel: true }));
    } finally {
      setTyping(false);
    }
  }, [addMessage, isTyping, setTyping, locale]);

  async function reportLatestAnswer() {
    if (!latestAssistantMessage?.backendMessageId || reportStatus === "pending") return;
    setReportStatus("pending");
    try {
      await reportAiMessage(latestAssistantMessage.backendMessageId);
      setReportStatus("done");
    } catch {
      setReportStatus("error");
    }
  }

  function resetAll() {
    resetConversation();
    reset(welcomeMessage);
    setReportStatus("idle");
  }

  return { messages, isTyping, latestAssistantMessage, ask, reportStatus, reportLatestAnswer, resetAll };
}
