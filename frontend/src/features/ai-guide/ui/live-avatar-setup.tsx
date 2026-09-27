"use client";

import { useState } from "react";
import { KeyRound, Settings2, Video } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { LiveAvatarStatus } from "../model/use-live-avatar";

interface Props {
  status: LiveAvatarStatus;
  streamReady: boolean;
  /** 서버 환경변수에 키가 있는지. 판정 전에는 null. */
  isConfigured: boolean | null;
  error: string | null;
  start: (options?: { apiKey?: string; avatarId?: string; sandbox?: boolean }) => void;
}

/** 왼쪽 위 연결 배지와, 설정 버튼으로 여는 수동 연결 패널. 입력값은 저장하지 않는다. */
export function LiveAvatarSetup({ status, streamReady, isConfigured, error, start }: Props) {
  const [showSetup, setShowSetup] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const connecting = status === "starting" || status === "connecting";

  return (
    <>
      <div className="absolute left-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/45 px-3 py-2 text-[0.6875rem] font-semibold text-white/90 shadow-sm backdrop-blur-md">
        <Video className={cn("size-3.5", streamReady ? "text-emerald-300" : "text-white/75")} />
        {streamReady ? "LiveAvatar 연결됨" : "Alan AI 아바타"}
        <button
          type="button"
          onClick={() => setShowSetup((visible) => !visible)}
          aria-label="한국어 API 연결 설정"
          className="ml-1 rounded-full bg-white/15 p-1 transition hover:bg-white/25"
        >
          <Settings2 className="size-3" />
        </button>
        {isConfigured && !streamReady && status === "idle" && (
          <button
            type="button"
            onClick={() => start()}
            className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            시작
          </button>
        )}
      </div>

      {showSetup && !streamReady && (
        <div className="absolute left-4 right-4 top-16 z-40 rounded-2xl border border-white/20 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-bold">
            <KeyRound className="size-3.5 text-emerald-300" />
            한국어 LiveAvatar 연결
          </div>
          <p className="mt-1 text-[0.625rem] leading-4 text-white/70">
            API 키와 LiveAvatar 대시보드의 한국인형 아바타 ID를 입력하면 이 화면에서 바로 사용합니다. 입력값은 저장하지 않습니다.
          </p>
          <div className="mt-2 grid gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="LiveAvatar API 키"
              autoComplete="off"
              className="h-9 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs text-white outline-none placeholder:text-white/45 focus:border-emerald-300"
            />
            <input
              type="text"
              value={avatarId}
              onChange={(event) => setAvatarId(event.target.value)}
              placeholder="한국인형 아바타 ID (UUID)"
              autoComplete="off"
              className="h-9 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs text-white outline-none placeholder:text-white/45 focus:border-emerald-300"
            />
            <label className="flex items-center gap-2 text-[0.625rem] text-white/75">
              <input
                type="checkbox"
                checked={sandbox}
                onChange={(event) => setSandbox(event.target.checked)}
                className="accent-emerald-400"
              />
              Sandbox로 테스트(크레딧 사용 안 함)
            </label>
            <button
              type="button"
              onClick={() => start({ apiKey: apiKey.trim() || undefined, avatarId: avatarId.trim() || undefined, sandbox })}
              disabled={connecting}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-400 px-3 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {connecting ? "아바타 연결 중…" : "한국어 아바타 시작"}
            </button>
          </div>
          {error && <p className="mt-2 text-[0.625rem] leading-4 text-red-200">{error}</p>}
        </div>
      )}
    </>
  );
}
