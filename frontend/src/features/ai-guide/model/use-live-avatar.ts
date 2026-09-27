"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";

export type LiveAvatarStatus = "idle" | "starting" | "connecting" | "connected" | "stopping" | "error";

interface StartOptions {
  apiKey?: string;
  avatarId?: string;
  sandbox?: boolean;
}

interface SessionResponse {
  sessionToken?: string;
  error?: string;
  message?: string;
}

const MAX_SPEECH_CHUNK_LENGTH = 90;
const RECONNECT_DELAYS_MS = [1_500, 3_000, 5_000, 10_000, 15_000] as const;

function splitSpeechChunks(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_SPEECH_CHUNK_LENGTH) return [normalized];

  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [normalized];
  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) chunks.push(buffer);
    buffer = "";
  };

  for (const sentence of sentences) {
    let remaining = sentence.trim();
    while (remaining.length > MAX_SPEECH_CHUNK_LENGTH) {
      const candidate = remaining.slice(0, MAX_SPEECH_CHUNK_LENGTH + 1).lastIndexOf(" ");
      const splitAt = candidate > MAX_SPEECH_CHUNK_LENGTH * 0.45 ? candidate : MAX_SPEECH_CHUNK_LENGTH;
      const part = remaining.slice(0, splitAt).trim();
      if (buffer && buffer.length + part.length + 1 > MAX_SPEECH_CHUNK_LENGTH) flush();
      chunks.push(part);
      remaining = remaining.slice(splitAt).trim();
    }

    if (!remaining) continue;
    if (buffer && buffer.length + remaining.length + 1 > MAX_SPEECH_CHUNK_LENGTH) flush();
    buffer = buffer ? `${buffer} ${remaining}` : remaining;
  }

  flush();
  return chunks.length > 0 ? chunks : [normalized];
}

export function useLiveAvatar() {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const currentSpeechEventIdRef = useRef<string | null>(null);
  const isSpeakingRef = useRef(false);
  const [status, setStatus] = useState<LiveAvatarStatus>("idle");
  const [streamReady, setStreamReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const startRef = useRef<((options?: StartOptions, isReconnect?: boolean) => Promise<void>) | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectEnabledRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const startOptionsRef = useRef<StartOptions>({});

  // 세션이 끊기거나 발화가 실패하면 큐·발화 상태를 한 번에 되돌린다. 네 군데에서 같은
  // 다섯 줄을 손으로 되돌리다 보면 한 곳만 빠져 큐에 남은 문장이 다음 세션에서 튀어나온다.
  const resetPlayback = useCallback(() => {
    setStreamReady(false);
    setIsSpeaking(false);
    speechQueueRef.current = [];
    currentSpeechEventIdRef.current = null;
    isSpeakingRef.current = false;
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current === null) return;
    window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!reconnectEnabledRef.current || reconnectTimerRef.current !== null) return;

    const attempt = reconnectAttemptRef.current;
    if (attempt >= RECONNECT_DELAYS_MS.length) {
      setStatus("error");
      setError("LiveAvatar 연결이 반복해서 끊겼습니다. 잠시 후 다시 시작해 주세요.");
      return;
    }

    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!reconnectEnabledRef.current || !startRef.current) return;
      void startRef.current(startOptionsRef.current, true);
    }, RECONNECT_DELAYS_MS[attempt]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/liveavatar/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((result) => {
        if (!cancelled) setIsConfigured(result.configured === true);
      })
      .catch(() => {
        if (!cancelled) setIsConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attachVideo = useCallback(() => {
    const session = sessionRef.current;
    const video = videoElementRef.current;
    if (!session || !video) return;
    session.attach(video);
    void video.play().catch(() => undefined);
  }, []);

  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element;
    attachVideo();
  }, [attachVideo]);

  const startInternal = useCallback(async (options: StartOptions = {}, isReconnect = false) => {
    if (sessionRef.current || status === "starting" || status === "connecting" || status === "connected") return;

    if (!isReconnect) {
      clearReconnectTimer();
      reconnectEnabledRef.current = true;
      reconnectAttemptRef.current = 0;
      startOptionsRef.current = options;
    } else if (!reconnectEnabledRef.current) {
      return;
    }

    setStatus("starting");
    setError(null);
    resetPlayback();

    try {
      const response = await fetch("/api/liveavatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
        signal: AbortSignal.timeout(15_000),
      });
      const result = (await response.json().catch(() => null)) as SessionResponse | null;
      if (!response.ok || !result?.sessionToken) {
        throw new Error(result?.message || result?.error || `LiveAvatar session failed (${response.status})`);
      }

      const session = new LiveAvatarSession(result.sessionToken);
      sessionRef.current = session;
      session.on(SessionEvent.SESSION_STATE_CHANGED, (nextState) => {
        if (nextState === SessionState.CONNECTED) {
          reconnectAttemptRef.current = 0;
          setStatus("connected");
        }
        else if (nextState === SessionState.CONNECTING) setStatus("connecting");
        else if (nextState === SessionState.DISCONNECTED) setStatus("idle");
      });
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        setStreamReady(true);
        attachVideo();
      });
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (sessionRef.current !== session) return;
        resetPlayback();
        setStatus("idle");
        sessionRef.current = null;
        scheduleReconnect();
      });
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, (event) => {
        if (currentSpeechEventIdRef.current && event.event_id !== currentSpeechEventIdRef.current) return;
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      });
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, (event) => {
        if (currentSpeechEventIdRef.current !== event.event_id) return;
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        const nextChunk = speechQueueRef.current.shift();
        if (!nextChunk) {
          currentSpeechEventIdRef.current = null;
          return;
        }
        window.setTimeout(() => {
          const activeSession = sessionRef.current;
          if (!activeSession) return;
          try {
            currentSpeechEventIdRef.current = activeSession.repeat(nextChunk);
          } catch {
            speechQueueRef.current = [];
            currentSpeechEventIdRef.current = null;
          }
        }, 0);
      });

      setStatus("connecting");
      await session.start();
      attachVideo();
      setIsConfigured(true);
    } catch (reason) {
      const failedSession = sessionRef.current;
      sessionRef.current = null;
      resetPlayback();
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "LiveAvatar를 시작하지 못했습니다.");
      if (failedSession) void failedSession.stop().catch(() => undefined);
      scheduleReconnect();
    }
  }, [attachVideo, clearReconnectTimer, resetPlayback, scheduleReconnect, status]);

  const start = useCallback((options: StartOptions = {}) => startInternal(options), [startInternal]);

  useEffect(() => {
    startRef.current = startInternal;
    return () => {
      if (startRef.current === startInternal) startRef.current = null;
    };
  }, [startInternal]);

  const stop = useCallback(async () => {
    reconnectEnabledRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    const session = sessionRef.current;
    if (!session) {
      setStatus("idle");
      return;
    }
    setStatus("stopping");
    try {
      await session.stop();
    } catch {
      // 세션이 이미 닫힌 경우에도 화면은 안전하게 초기화한다.
    } finally {
      sessionRef.current = null;
      resetPlayback();
      setStatus("idle");
    }
  }, [clearReconnectTimer, resetPlayback]);

  const speak = useCallback((text: string) => {
    if (!text.trim() || status !== "connected" || !sessionRef.current) return false;
    const session = sessionRef.current;
    try {
      if (isSpeakingRef.current) session.interrupt();
      speechQueueRef.current = splitSpeechChunks(text);
      const firstChunk = speechQueueRef.current.shift();
      if (!firstChunk) return false;
      currentSpeechEventIdRef.current = session.repeat(firstChunk);
      return true;
    } catch {
      resetPlayback();
      return false;
    }
  }, [resetPlayback, status]);

  useEffect(() => {
    return () => {
      reconnectEnabledRef.current = false;
      clearReconnectTimer();
      const session = sessionRef.current;
      sessionRef.current = null;
      resetPlayback();
      if (session) void session.stop().catch(() => undefined);
    };
  }, [clearReconnectTimer, resetPlayback]);

  return {
    videoRef: setVideoElement,
    status,
    streamReady,
    isSpeaking,
    isConfigured,
    error,
    start,
    stop,
    speak,
  };
}
