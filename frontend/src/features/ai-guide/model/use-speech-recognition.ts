"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/shared/lib/i18n";

// ponytail: 브라우저 SpeechRecognition은 표준 TS 타입이 없어 쓰는 부분만 최소로 선언한다.
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: (audioTrack?: MediaStreamTrack) => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionConstructor() {
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

interface UseSpeechRecognitionOptions {
  /** 인식 언어 (BCP-47, 예: "ko-KR") */
  bcp47: string;
  t: Dictionary;
  onFinalResult: (transcript: string) => void;
}

export function useSpeechRecognition({ bcp47, t, onFinalResult }: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");
  const onFinalResultRef = useRef(onFinalResult);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  // 서버 렌더 결과와 어긋나지 않도록 마운트 이후에 지원 여부를 확정한다.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsSupported(Boolean(getRecognitionConstructor())));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const releaseMicrophone = useCallback(() => {
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    releaseMicrophone();
  }, [releaseMicrophone]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(async () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError(t.aiGuide.errors.unsupported);
      return;
    }

    recognitionRef.current?.abort();
    finalTranscriptRef.current = "";
    setInterimTranscript("");
    setError(null);
    setIsPreparing(true);

    try {
      releaseMicrophone();
      microphoneRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: { ideal: true },
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setError(name === "NotAllowedError" ? t.aiGuide.errors.notAllowed : t.aiGuide.errors.audioCapture);
      setIsPreparing(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = bcp47;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscriptRef.current += transcript;
        else interim += transcript;
      }
      setInterimTranscript(interim || finalTranscriptRef.current);
    };
    recognition.onerror = (event) => {
      const errorMessages: Record<string, string> = {
        "not-allowed": t.aiGuide.errors.notAllowed,
        "service-not-allowed": t.aiGuide.errors.serviceNotAllowed,
        "audio-capture": t.aiGuide.errors.audioCapture,
        "no-speech": t.aiGuide.errors.noSpeech,
        network: t.aiGuide.errors.network,
      };
      setError(errorMessages[event.error] ?? t.aiGuide.errors.unknown);
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      recognitionRef.current = null;
      releaseMicrophone();

      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      if (transcript) onFinalResultRef.current(transcript);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start(microphoneRef.current.getAudioTracks()[0]);
    } catch {
      recognitionRef.current = null;
      releaseMicrophone();
      setIsListening(false);
      setError(t.aiGuide.errors.startFailed);
    } finally {
      setIsPreparing(false);
    }
  }, [bcp47, releaseMicrophone, t]);

  return { error, interimTranscript, isListening, isPreparing, isSupported, startListening, stopListening };
}
