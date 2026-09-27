"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bus,
  CalendarDays,
  Keyboard,
  Languages,
  MapPin,
  Mic,
  RotateCcw,
  SendHorizontal,
  Square,
  Users,
  Volume2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Form } from "@/shared/ui/form";
import { AccessibilitySheet } from "@/shared/ui/accessibility-sheet";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { useFestivalLanguages } from "@/shared/lib/i18n/festival-languages";
import { useSpeechOutput } from "@/shared/lib/use-speech-output";
import { useLiveAvatar } from "../model/use-live-avatar";
import { detectLocale, LANGUAGE_BY_LOCALE, useTranslation, type Locale } from "@/shared/lib/i18n";
import { WELCOME_MESSAGE_ID } from "../model/chat-store";
import { useAiChat } from "../model/use-ai-chat";
import { useSpeechRecognition } from "../model/use-speech-recognition";
import { AvatarStage } from "./avatar-stage";
import { ChatMessage } from "./chat-message";
import { LiveAvatarSetup } from "./live-avatar-setup";

const QUESTION_ICON = {
  congestion: Users,
  transport: Bus,
  facility: MapPin,
  schedule: CalendarDays,
} as const;

export function PersoAiGuide() {
  const { t, locale, bcp47 } = useTranslation();
  const { messages, isTyping, latestAssistantMessage, ask, reportStatus, reportLatestAnswer, resetAll } = useAiChat(locale);
  const { largeText, voiceGuide, visitorMode, languageSource, setLanguage } = useAccessibilityStore();
  const { languages } = useFestivalLanguages();
  const [draft, setDraft] = useState("");
  const [isVoiceConfirmation, setIsVoiceConfirmation] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const [switchedFrom, setSwitchedFrom] = useState<Locale | null>(null);
  const autoStartLiveAvatarRef = useRef(false);
  const spokenAvatarMessageRef = useRef<string | undefined>(undefined);
  const {
    videoRef: setLiveAvatarVideo,
    status: liveAvatarStatus,
    streamReady: liveAvatarStreamReady,
    isSpeaking: liveAvatarIsSpeaking,
    isConfigured: liveAvatarIsConfigured,
    error: liveAvatarError,
    start: startLiveAvatarSession,
    speak: speakLiveAvatar,
  } = useLiveAvatar();

  const latestAssistantMessageId = latestAssistantMessage?.id;
  const latestAssistantMessageContent = latestAssistantMessage?.content;

  // 새 말풍선이 붙으면 가장 최근 대화가 보이도록 맨 아래로 따라간다.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, isTyping]);

  // LiveAvatar가 연결되면 기존 브라우저/CosyVoice 음성은 끄고 아바타 음성만 사용한다.
  // 연결에 실패했을 때는 기존 음성 안내로 즉시 돌아가므로 안내 기능이 사라지지 않는다.
  const { status: voiceStatus, mouthOpen, replay: replayVoice } = useSpeechOutput(
    latestAssistantMessageContent,
    { enabled: voiceGuide && !liveAvatarStreamReady, bcp47 },
  );
  const isSpeaking = liveAvatarIsSpeaking || voiceStatus === "playing" || voiceStatus === "fallback";

  // 서버 환경변수에 API 키와 아바타 ID가 있으면 AI 안내 화면 진입과 함께 세션을 연다.
  // 연결 설정 패널은 사용자가 왼쪽 위 설정 버튼을 눌렀을 때만 연다.
  useEffect(() => {
    if (liveAvatarIsConfigured !== true || autoStartLiveAvatarRef.current) return;
    autoStartLiveAvatarRef.current = true;
    void startLiveAvatarSession();
  }, [liveAvatarIsConfigured, startLiveAvatarSession]);

  // Alan AI가 새 답변을 만들면 같은 한국어 문장을 LiveAvatar에 그대로 전달한다.
  // 질문 전에 켜지지 않았더라도 영상 스트림이 준비되는 순간 최신 답변을 한 번 재생한다.
  useEffect(() => {
    if (!liveAvatarStreamReady || !latestAssistantMessageId || !latestAssistantMessageContent || latestAssistantMessageId === WELCOME_MESSAGE_ID) return;
    if (spokenAvatarMessageRef.current === latestAssistantMessageId) return;
    if (speakLiveAvatar(latestAssistantMessageContent)) spokenAvatarMessageRef.current = latestAssistantMessageId;
  }, [latestAssistantMessageContent, latestAssistantMessageId, liveAvatarStreamReady, speakLiveAvatar]);

  // AI-05: 키오스크에서 방문객이 언어를 직접 고르기 전까지는 발화 언어를 따라간다.
  // 판별 실패·미지원 언어면 detectLocale이 null을 주고 기존(축제 기본) 언어를 유지한다.
  const handleVoiceResult = useCallback((transcript: string) => {
    setDraft(transcript);
    setIsVoiceConfirmation(true);
    setShowTextInput(true);
  }, []);

  const submitVoiceQuestion = useCallback((transcript: string) => {
    const autoLocale = visitorMode === "kiosk" && languageSource !== "MANUAL"
      ? detectLocale(transcript, languages)
      : null;
    if (autoLocale && autoLocale !== locale) {
      setLanguage(autoLocale, "AUTO");
      setSwitchedFrom(locale);
      void ask(transcript, autoLocale);
      return;
    }
    void ask(transcript);
  }, [ask, languageSource, languages, locale, setLanguage, visitorMode]);

  function revertLanguage() {
    if (!switchedFrom) return;
    // 되돌리면 방문객이 고른 언어가 되므로 다음 발화에서 다시 자동 전환되지 않는다.
    setLanguage(switchedFrom, "MANUAL");
    setSwitchedFrom(null);
  }

  const {
    error: speechError,
    interimTranscript,
    isListening,
    isPreparing,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({ bcp47, t, onFinalResult: handleVoiceResult });

  // 음성 인식을 못 쓰는 브라우저(또는 소음이 큰 현장)에서는 글로 묻는 게 유일한 길이라 처음부터 열어 둔다.
  const textInputOpen = showTextInput || !isSpeechSupported;

  // 패널은 내용만큼 자라고 아래 범위 안에서 멈춘다. 넘치면 대화 영역이 스크롤한다.
  // 글자 수로 높이를 추정하던 자리 — 큰 글씨·줄바꿈에 따라 어긋나던 것을 실제 레이아웃에 맡긴다.
  const chatPanelHeight = textInputOpen ? "min-h-[400px] max-h-[470px]" : "min-h-[340px] max-h-[450px]";

  function handleSubmit() {
    const question = draft.trim();
    if (!question || isTyping || isListening) return;

    setDraft("");
    if (isVoiceConfirmation) submitVoiceQuestion(question);
    else ask(question);
    setIsVoiceConfirmation(false);
  }

  function startNewRecording() {
    setDraft("");
    setIsVoiceConfirmation(false);
    void startListening();
  }

  return (
    <section className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
      <AvatarStage
        imageAlt={t.aiGuide.imageAlt}
        videoRef={setLiveAvatarVideo}
        streamReady={liveAvatarStreamReady}
        isSpeaking={isSpeaking}
        mouthOpen={mouthOpen}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-slate-950/10 via-slate-950/5 to-slate-950/50" />

      <LiveAvatarSetup
        status={liveAvatarStatus}
        streamReady={liveAvatarStreamReady}
        isConfigured={liveAvatarIsConfigured}
        error={liveAvatarError}
        start={(options) => void startLiveAvatarSession(options)}
      />

      <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-slate-950/45 px-3 py-2 text-[0.6875rem] font-semibold text-white/90 backdrop-blur-md">
        <Volume2 className="size-3.5 text-primary-tint" />
        {liveAvatarStreamReady ? "한국어 아바타 음성" : t.aiGuide.voiceReadyBadge}
        {(voiceGuide || liveAvatarStreamReady) && (
          <button
            type="button"
            onClick={() => {
              if (liveAvatarStreamReady && latestAssistantMessage) speakLiveAvatar(latestAssistantMessage.content);
              else replayVoice();
            }}
            aria-label={t.accessibility.voiceGuideLabel}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[0.625rem] text-white transition hover:bg-white/25"
          >
            재생
          </button>
        )}
      </div>

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <AccessibilitySheet triggerClassName="size-10 border-white/20 bg-slate-950/40 text-white backdrop-blur-md hover:bg-slate-950/60 hover:text-white" />
        <button
          type="button"
          aria-label={t.aiGuide.resetAria}
          onClick={() => { resetAll(); setSwitchedFrom(null); }}
          className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/40 text-white backdrop-blur-md transition hover:bg-slate-950/60"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-[30px] border-t border-white/45 bg-white/70 text-foreground shadow-[0_-18px_52px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-[min-height,max-height] duration-300 ease-out",
          chatPanelHeight,
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-linear-to-b from-white/90 via-white/40 to-transparent" />

        <div
          ref={threadRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-8"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, black 36px, black 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 36px, black 100%)",
          }}
        >
          {/* 마지막 한 마디만 남기면 앞서 안내받은 시간·장소를 다시 볼 수 없다 — 대화를 통째로 보여준다. */}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLatestAssistant={message.id === latestAssistantMessageId}
              reportStatus={reportStatus}
              onReport={() => void reportLatestAnswer()}
            />
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="size-1.5 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative z-30 shrink-0 bg-transparent px-4 pb-2 pt-1.5">
          {switchedFrom && (
            <div
              aria-live="polite"
              className="mb-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[0.6875rem] font-semibold text-foreground"
            >
              <Languages className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">{t.aiGuide.autoSwitchNotice(LANGUAGE_BY_LOCALE[locale])}</span>
              <button
                type="button"
                onClick={revertLanguage}
                lang={switchedFrom}
                aria-label={t.aiGuide.autoSwitchRevertAria(LANGUAGE_BY_LOCALE[switchedFrom])}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-bold text-foreground"
              >
                <RotateCcw className="size-3" />
                {LANGUAGE_BY_LOCALE[switchedFrom]}
              </button>
            </div>
          )}

          <div className="flex flex-col items-center pb-1">
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
              <span aria-hidden="true" />
              <button
                type="button"
                onClick={isListening ? stopListening : startNewRecording}
                disabled={isTyping || isPreparing || !isSpeechSupported}
                aria-label={isListening ? t.aiGuide.micStopAria : t.aiGuide.micStartAria}
                aria-pressed={isListening}
                className={cn(
                  "relative flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-white/80 text-white shadow-[0_8px_24px_rgba(1,71,255,0.35)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
                  isListening ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90",
                )}
              >
                {isListening && <span className="absolute -inset-2 animate-ping rounded-full border-2 border-red-400/45" />}
                {isListening ? <Square className="relative size-5 fill-current" /> : <Mic className="size-7" />}
              </button>

              <div className="flex justify-start pl-3">
                <button
                  type="button"
                  onClick={() => setShowTextInput((visible) => !visible)}
                  disabled={isListening || isVoiceConfirmation}
                  aria-label={textInputOpen ? t.aiGuide.keyboardCloseAria : t.aiGuide.keyboardOpenAria}
                  aria-expanded={textInputOpen}
                  aria-controls="perso-text-question"
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-white/75 shadow-sm backdrop-blur-md transition active:scale-95 disabled:opacity-40",
                    textInputOpen
                      ? "bg-slate-900 text-white"
                      : "bg-white/82 text-slate-700 hover:bg-white",
                  )}
                >
                  <Keyboard className="size-6" />
                </button>
              </div>
            </div>

            <p className="mt-1.5 min-h-4 text-center text-[0.625rem] font-semibold text-foreground/80">
              {isListening
                ? interimTranscript || t.aiGuide.listeningPlaceholder
                : isPreparing
                  ? t.aiGuide.preparingMicrophone
                  : isVoiceConfirmation
                    ? t.aiGuide.confirmVoicePrompt
                    : t.aiGuide.idlePrompt}
            </p>

            {textInputOpen && (
              <Form
                id="perso-text-question"
                onSubmit={handleSubmit}
                className="mt-2 flex w-full items-center gap-1.5 rounded-2xl border border-white/65 bg-white/88 p-1.5 shadow-sm backdrop-blur-md"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={isTyping}
                  aria-label={t.aiGuide.textInputAria}
                  placeholder={t.aiGuide.textInputPlaceholder}
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/75"
                />
                {isVoiceConfirmation && (
                  <button
                    type="button"
                    onClick={startNewRecording}
                    disabled={isTyping || isPreparing}
                    aria-label={t.aiGuide.retryVoiceAria}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:opacity-30"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!draft.trim() || isTyping}
                  aria-label={isVoiceConfirmation ? t.aiGuide.confirmVoiceAria : t.aiGuide.sendAria}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <SendHorizontal className="size-4" />
                </button>
              </Form>
            )}
          </div>

          <p
            aria-live="polite"
            className={cn(
              "min-h-4 px-1 pt-1 text-[0.5625rem] font-medium text-muted-foreground",
              speechError && "text-red-600",
              isListening && "text-red-600",
            )}
          >
            {speechError ??
              (isPreparing
                ? t.aiGuide.preparingMicrophone
                : isListening
                  ? t.aiGuide.statusListening
                  : isVoiceConfirmation
                    ? t.aiGuide.statusConfirmVoice
                : isSpeechSupported
                  ? t.aiGuide.statusIdleSupported
                  : t.aiGuide.statusUnsupported)}
          </p>

          <p className={cn("mb-1.5 text-[0.625rem] font-bold tracking-[0.12em] text-muted-foreground", largeText && "text-xs")}>
            {t.aiGuide.expectedQuestionsLabel}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {t.aiGuide.expectedQuestions.map(({ key, label }) => {
              const Icon = QUESTION_ICON[key as keyof typeof QUESTION_ICON];
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isTyping}
                  onClick={() => ask(label)}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/55 bg-white/72 px-3 py-1.5 text-left text-[0.6875rem] font-semibold text-foreground shadow-sm backdrop-blur-md transition hover:border-primary/40 hover:bg-white/90 disabled:opacity-50",
                    largeText && "text-sm",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {voiceGuide && <span className="sr-only" aria-live="polite">{t.aiGuide.voiceGuideOnAnnouncement}</span>}
    </section>
  );
}
