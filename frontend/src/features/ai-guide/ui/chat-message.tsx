"use client";

import { CheckCircle2, Flag, Headset, Phone, Sparkles } from "lucide-react";
import type { ChatMessage as Message } from "@/entities/visitor";
import { useTranslation } from "@/shared/lib/i18n";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/shared/lib/support-contact";
import { LastUpdated } from "@/shared/ui/last-updated";
import type { ReportStatus } from "../model/use-ai-chat";

interface Props {
  message: Message;
  /** 신고 상태는 한 벌뿐이라 방금 받은 답변에만 신고 버튼을 붙인다. */
  isLatestAssistant: boolean;
  reportStatus: ReportStatus;
  onReport: () => void;
}

export function ChatMessage({ message, isLatestAssistant, reportStatus, onReport }: Props) {
  const { t, bcp47 } = useTranslation();

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line text-primary-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/55 bg-white/78 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed whitespace-pre-line text-card-foreground shadow-sm backdrop-blur-md">
      <span className="mb-1 flex items-center gap-1 text-[0.625rem] font-bold text-primary">
        <Sparkles className="size-3" /> {t.aiGuide.assistantLabel}
      </span>
      {message.content}
      {(message.sources?.length || message.freshnessAt) && (
        <div className="mt-1.5 space-y-0.5 border-t border-border/70 pt-1.5">
          {message.sources && message.sources.length > 0 && (
            <p className="text-[0.5625rem] opacity-60">
              {t.aiGuide.sourcePrefix}{message.sources.join(", ")}
            </p>
          )}
          <LastUpdated
            value={message.freshnessAt}
            bcp47={bcp47}
            label={t.aiGuide.answerFreshness}
            className="text-[0.5625rem] opacity-60"
          />
        </div>
      )}

      {message.needsFallbackChannel && (
        <div className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50/90 p-2.5 text-amber-900">
          <p className="flex items-center gap-1 text-[0.625rem] font-bold">
            <Headset className="size-3" /> {t.aiGuide.fallbackChannelTitle}
          </p>
          <p className="mt-1 text-[0.625rem] leading-4">{t.aiGuide.fallbackChannelDescription}</p>
          <a
            href={SUPPORT_PHONE_HREF}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-900 px-2.5 py-1 text-[0.625rem] font-bold text-white"
          >
            <Phone className="size-3" /> {t.aiGuide.fallbackCallAction(SUPPORT_PHONE)}
          </a>
        </div>
      )}
      {message.backendMessageId && isLatestAssistant && (
        <div className="mt-2 flex items-center justify-end border-t border-border/70 pt-2">
          <button
            type="button"
            onClick={onReport}
            disabled={reportStatus === "pending" || reportStatus === "done"}
            className="inline-flex min-h-9 items-center gap-1 text-[0.625rem] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {reportStatus === "done" ? <CheckCircle2 className="size-3" /> : <Flag className="size-3" />}
            {reportStatus === "pending" ? t.aiGuide.reportPending : reportStatus === "done" ? t.aiGuide.reportDone : t.aiGuide.reportAction}
          </button>
        </div>
      )}
      {reportStatus === "error" && isLatestAssistant && (
        <p className="mt-1 text-right text-[0.5625rem] text-red-600">{t.aiGuide.reportFailed}</p>
      )}
    </div>
  );
}
