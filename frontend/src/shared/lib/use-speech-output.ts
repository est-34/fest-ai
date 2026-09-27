"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceStatus = "idle" | "synthesizing" | "playing" | "fallback";

interface VoiceResponse {
  data?: {
    audioBase64?: string;
    mimeType?: string;
    provider?: string;
  };
}

const VOICE_ENDPOINT = "/api/voice/synthesize";
const VOICE_MODE = process.env.NEXT_PUBLIC_VOICE_MODE ?? "browser";
// 방문객 화면은 모델이 차갑게 시작되거나 CPU 추론이 길어져도 4초 이상 멈추지 않는다.
// CosyVoice가 준비된 뒤 빠르게 응답하면 서버 음성을 사용하고, 아니면 브라우저 음성으로 즉시 대체한다.
const VOICE_TIMEOUT_MS = 4_000;

function stopAudio(audioRef: { current: HTMLAudioElement | null }, urlRef: { current: string | null }) {
  audioRef.current?.pause();
  audioRef.current = null;
  if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  urlRef.current = null;
}

function stopMouthAnimation(
  frameRef: { current: number | null },
  contextRef: { current: AudioContext | null },
  setMouthOpen: (value: number) => void,
) {
  if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
  if (contextRef.current) void contextRef.current.close();
  contextRef.current = null;
  setMouthOpen(0);
}

/**
 * 음성 안내가 켜져 있으면 새 안내 문장을 소리 내 읽는다.
 * CosyVoice 3 FastAPI가 연결되어 있으면 서버 음성을 우선 사용하고,
 * 모델 서버가 아직 준비되지 않은 로컬 환경에서는 브라우저 음성으로 대체한다.
 */
export function useSpeechOutput(text: string | undefined, { enabled, bcp47 }: { enabled: boolean; bcp47: string }) {
  const spokenRef = useRef<string | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mouthFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [replayVersion, setReplayVersion] = useState(0);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [mouthOpen, setMouthOpen] = useState(0);

  const speakWithBrowser = useCallback((value: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopAudio(audioRef, audioUrlRef);
    stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
    setStatus("fallback");
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = bcp47;
    const startedAt = performance.now();
    const pulse = () => {
      setMouthOpen(0.18 + Math.abs(Math.sin((performance.now() - startedAt) / 115)) * 0.62);
      mouthFrameRef.current = requestAnimationFrame(pulse);
    };
    mouthFrameRef.current = requestAnimationFrame(pulse);
    utterance.onend = () => {
      stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
      setStatus("idle");
    };
    utterance.onerror = () => {
      stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
      setStatus("idle");
    };
    window.speechSynthesis.cancel();
    // 키오스크·모바일 브라우저에서 멈춘 큐를 깨우고, 버튼 클릭 직후에도 재생되게 한다.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, [bcp47]);

  useEffect(() => {
    if (!enabled) {
      window.speechSynthesis?.cancel();
      stopAudio(audioRef, audioUrlRef);
      stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
      spokenRef.current = undefined;
      const resetStatus = window.setTimeout(() => setStatus("idle"), 0);
      return () => window.clearTimeout(resetStatus);
    }
    if (!text || (spokenRef.current === text && replayVersion === 0)) return;

    const spokenText = text;
    spokenRef.current = spokenText;

    // 기본값은 완전한 온디바이스 데모다. CosyVoice 백엔드는 운영 환경에서
    // NEXT_PUBLIC_VOICE_MODE=remote를 명시한 경우에만 사용한다.
    if (VOICE_MODE !== "remote") {
      const startFallback = window.setTimeout(() => speakWithBrowser(spokenText), 0);
      return () => {
        window.clearTimeout(startFallback);
        stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
      };
    }

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;

    function startAudioAnimation(audio: HTMLAudioElement) {
      if (!window.AudioContext) return;
      try {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        const source = context.createMediaElementSource(audio);
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(context.destination);
        audioContextRef.current = context;
        const samples = new Uint8Array(analyser.fftSize);
        const sample = () => {
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const value of samples) {
            const normalized = (value - 128) / 128;
            energy += normalized * normalized;
          }
          const level = Math.min(1, Math.sqrt(energy / samples.length) * 5);
          setMouthOpen(level);
          mouthFrameRef.current = requestAnimationFrame(sample);
        };
        mouthFrameRef.current = requestAnimationFrame(sample);
        void context.resume().catch(() => undefined);
      } catch {
        // 일부 키오스크 브라우저는 AudioContext를 막을 수 있다. 재생은 계속하고
        // 음성 출력 상태만으로 입 모양을 움직이는 fallback을 사용한다.
        speakWithBrowser(spokenText);
      }
    }

    async function synthesize() {
      setStatus("synthesizing");
      try {
        const response = await fetch(VOICE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: bcp47, provider: "cosyvoice3" }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`voice-api-${response.status}`);
        const payload = (await response.json()) as VoiceResponse;
        const audioBase64 = payload.data?.audioBase64;
        if (!audioBase64 || cancelled) throw new Error("voice-audio-missing");

        const mimeType = payload.data?.mimeType ?? "audio/wav";
        const binary = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([binary], { type: mimeType }));
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          stopAudio(audioRef, audioUrlRef);
          stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
          setStatus("idle");
        };
        audio.onerror = () => {
          stopAudio(audioRef, audioUrlRef);
          stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
          speakWithBrowser(spokenText);
        };
        startAudioAnimation(audio);
        setStatus("playing");
        await audio.play();
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError" && !timedOut)) return;
        speakWithBrowser(spokenText);
      }
    }

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, VOICE_TIMEOUT_MS);
    void synthesize();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      stopAudio(audioRef, audioUrlRef);
      stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
    };
  }, [text, enabled, bcp47, replayVersion, speakWithBrowser]);

  // 화면을 떠나면 읽던 문장을 끊는다 — 뒤로 가기 후에도 계속 말하면 사용자가 멈출 방법이 없다.
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    stopAudio(audioRef, audioUrlRef);
    stopMouthAnimation(mouthFrameRef, audioContextRef, setMouthOpen);
  }, []);

  const replay = useCallback(() => {
    if (!enabled || !text) return;
    if (VOICE_MODE === "remote") {
      setReplayVersion((value) => value + 1);
      return;
    }
    speakWithBrowser(text);
  }, [enabled, speakWithBrowser, text]);

  return { status, mouthOpen, replay };
}
