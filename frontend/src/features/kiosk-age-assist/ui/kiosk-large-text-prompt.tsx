"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ALargeSmall, Camera, Languages, LoaderCircle } from "lucide-react";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { LanguageBar } from "@/shared/ui/language-bar";
import { useTranslation } from "@/shared/lib/i18n";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { fetchKioskCameraEnabled, recordKioskAssist } from "../api/kiosk-assist";
import { AGE_MODEL_VERSION, estimateAgeBand } from "../model/estimate-age";

/** 키오스크에 90초 동안 입력이 없으면 다음 방문객으로 간주한다. */
const IDLE_RESET_MS = 90_000;

function useKioskFlow(): number {
  const [flow, setFlow] = useState(0);
  const lastActivity = useRef(0);

  useEffect(() => {
    lastActivity.current = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity.current > IDLE_RESET_MS) setFlow((value) => value + 1);
      lastActivity.current = now;
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, []);

  return flow;
}

type Phase = "idle" | "checking" | "suggest" | "done";

/**
 * 키오스크 모드에 들어오면 카메라 연령대 확인을 자동 시작한다.
 * 얼굴 영상은 estimateAgeBand 내부에서 기기 안에서만 처리하고, 결과가 중장년층일 때만
 * 큰 글씨와 언어를 선택할 수 있는 안내 팝업을 보여 준다.
 */
export function KioskLargeTextPrompt() {
  const { t } = useTranslation();
  const flow = useKioskFlow();
  const visitorMode = useAccessibilityStore((state) => state.visitorMode);
  const largeText = useAccessibilityStore((state) => state.largeText);
  const toggleLargeText = useAccessibilityStore((state) => state.toggleLargeText);
  const assistRoute = visitorMode === "kiosk";
  const [phaseState, setPhaseState] = useState<{ flow: number; phase: Phase }>({ flow: -1, phase: "idle" });
  const phase = phaseState.flow === flow ? phaseState.phase : "idle";
  const setPhase = useCallback((next: Phase) => setPhaseState({ flow, phase: next }), [flow]);

  // 관리자 화면에서 카메라 기능을 끄면 다음 요청부터 즉시 자동 확인도 멈춘다.
  const cameraQuery = useQuery({
    queryKey: ["kiosk-camera-enabled"],
    queryFn: fetchKioskCameraEnabled,
    enabled: assistRoute,
    refetchInterval: 60_000,
  });
  const enabled = assistRoute && cameraQuery.data === true;

  const completed = useRef(-1);
  useEffect(() => {
    if (!enabled || completed.current === flow) return;
    completed.current = flow;
    void recordKioskAssist("TASK_COMPLETED");
  }, [enabled, flow]);

  // AI 안내 페이지에 들어오면 별도 버튼 없이 바로 카메라 확인을 시작한다.
  const started = useRef(-1);
  useEffect(() => {
    if (!assistRoute) started.current = -1;
  }, [assistRoute]);

  useEffect(() => {
    if (!enabled || largeText || started.current === flow) return;
    started.current = flow;
    let cancelled = false;
    setPhase("checking");
    void recordKioskAssist("CONSENT_GRANTED", AGE_MODEL_VERSION);

    void estimateAgeBand().then((result) => {
      if (cancelled) return;
      if (result.status === "senior") {
        void recordKioskAssist("ESTIMATE_RESULT", AGE_MODEL_VERSION, "SENIOR");
        setPhase("suggest");
        void recordKioskAssist("SUGGESTED", AGE_MODEL_VERSION);
        return;
      }
      void recordKioskAssist(
        "ESTIMATE_RESULT",
        AGE_MODEL_VERSION,
        result.status === "unavailable" ? "UNAVAILABLE" : "OTHER",
      );
      setPhase("done");
      if (result.status === "unavailable") void recordKioskAssist("ESTIMATE_FAILED", AGE_MODEL_VERSION);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, flow, largeText, setPhase]);

  const accept = useCallback(() => {
    setPhase("done");
    if (!useAccessibilityStore.getState().largeText) toggleLargeText();
    void recordKioskAssist("ACCEPTED", AGE_MODEL_VERSION);
  }, [setPhase, toggleLargeText]);

  const dismiss = useCallback(() => {
    setPhase("done");
    void recordKioskAssist("DISMISSED", AGE_MODEL_VERSION);
  }, [setPhase]);

  if (!enabled || largeText || phase === "done" || phase === "idle") return null;

  const copy = t.kioskAssist;
  if (phase === "checking") {
    return (
      <div
        aria-live="polite"
        className="mx-auto flex w-full max-w-md items-center justify-center gap-2 border-t border-border bg-card px-3 py-3 text-sm text-muted-foreground shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {copy.checking}
      </div>
    );
  }

  return (
    <Dialog open={phase === "suggest"} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100vh-2rem)] overflow-y-auto p-5 sm:max-w-md">
        <DialogHeader>
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Camera className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl font-bold">{copy.consentTitle}</DialogTitle>
          <DialogDescription>{copy.consentDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Languages className="size-4" aria-hidden="true" />
              {t.accessibility.languageLabel}
            </p>
            <LanguageBar className="mt-3" buttonClassName="min-h-11 text-sm font-semibold" />
          </div>

          <Button size="lg" className="min-h-14 w-full text-base font-bold" onClick={accept}>
            <ALargeSmall className="size-5" aria-hidden="true" />
            {copy.suggestAccept}
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="min-h-12 w-full text-base font-semibold"
            onClick={dismiss}
          >
            {copy.consentDecline}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
