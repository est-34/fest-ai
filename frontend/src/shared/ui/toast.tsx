"use client";

import { create } from "zustand";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Tone = "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const DISMISS_MS = 4000;

/** 자동 소멸 타이머. 마우스를 올린 동안 멈췄다가 벗어나면 다시 센다. */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const useToastStore = create<{
  toasts: Toast[];
  push: (message: string, tone: Tone) => void;
  dismiss: (id: number) => void;
}>((set, get) => ({
  toasts: [],
  push: (message, tone) => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    // 실패 알림은 읽고 조치해야 하는 내용이라 시간이 지나도 지우지 않는다 — 직접 닫게 둔다.
    if (tone !== "error") timers.set(id, setTimeout(() => get().dismiss(id), DISMISS_MS));
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

function hold(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

function release(id: number, tone: Tone) {
  if (tone === "error" || timers.has(id)) return;
  timers.set(id, setTimeout(() => useToastStore.getState().dismiss(id), DISMISS_MS));
}

/** React 밖(react-query mutation cache)에서도 부를 수 있도록 store를 직접 씁니다. */
export function toast(message: string, tone: Tone = "success") {
  useToastStore.getState().push(message, tone);
}

export function Toaster() {
  return (
    // 방문객 화면의 하단 탭바를 가리지 않도록 그 위로 띄운다.
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4">
      {/* 라이브 리전은 알림이 들어오기 전부터 DOM에 있어야 스크린리더가 변화를 읽는다. 그래서
          role/aria-live를 매번 새로 만들어지는 알림이 아니라 고정된 이 두 컨테이너에 둔다. */}
      <ToastRegion tone="error" />
      <ToastRegion tone="success" />
    </div>
  );
}

function ToastRegion({ tone: region }: { tone: Tone }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      role={region === "error" ? "alert" : "status"}
      aria-live={region === "error" ? "assertive" : "polite"}
      className="flex w-full flex-col items-center gap-2"
    >
      {toasts.filter((item) => item.tone === region).map(({ id, message, tone }) => (
        <div
          key={id}
          onMouseEnter={() => hold(id)}
          onMouseLeave={() => release(id, tone)}
          onFocusCapture={() => hold(id)}
          onBlurCapture={() => release(id, tone)}
          className={cn(
            "pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg",
            tone === "error"
              ? "border-destructive/30 bg-destructive text-white"
              : "border-border bg-card text-foreground",
          )}
        >
          {tone === "error" ? <XCircle className="mt-px size-4 shrink-0" /> : <CheckCircle2 className="mt-px size-4 shrink-0 text-emerald-600" />}
          <span className="min-w-0 flex-1">{message}</span>
          <button
            onClick={() => dismiss(id)}
            className="-my-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-xs opacity-60 hover:opacity-100"
            aria-label="알림 닫기"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
