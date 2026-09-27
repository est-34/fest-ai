"use client";

import Image from "next/image";
import { useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { useOnDeviceFaceMouth } from "../model/use-on-device-face-mouth";

interface Props {
  imageAlt: string;
  /** LiveAvatar 영상 element를 훅에 연결하는 ref 콜백. */
  videoRef: (element: HTMLVideoElement | null) => void;
  streamReady: boolean;
  isSpeaking: boolean;
  /** 0~1. 내장 이미지 아바타의 입 벌림 정도(LiveAvatar 연결 시에는 쓰지 않는다). */
  mouthOpen: number;
}

/** 배경 아바타 — 정지 이미지 위에 LiveAvatar 영상을 겹치고, 영상이 없을 때만 입을 움직인다. */
export function AvatarStage({ imageAlt, videoRef, streamReady, isSpeaking, mouthOpen }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const mouthAnchor = useOnDeviceFaceMouth(imageRef, stageRef);

  return (
    <div ref={stageRef} className="absolute inset-0 z-0 overflow-hidden">
      <div className={cn("ai-avatar-stage absolute inset-0", isSpeaking && "ai-avatar-speaking")}>
        <Image
          ref={imageRef}
          src="/images/perso-ai-guide.png"
          alt={imageAlt}
          fill
          priority
          sizes="(max-width: 448px) 100vw, 448px"
          className={cn("object-cover object-[center_10%] transition-opacity duration-500", streamReady && "opacity-0")}
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          aria-label="LiveAvatar 한국어 AI 안내 아바타"
          className={cn(
            "absolute inset-0 size-full object-cover object-[center_10%] transition-opacity duration-500",
            streamReady ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#8b2332]/80 shadow-[0_1px_4px_rgba(40,0,0,0.35)] transition-[height,opacity] duration-75",
            isSpeaking && !streamReady ? "opacity-75" : "opacity-0",
          )}
          style={{
            left: `${mouthAnchor.left}%`,
            top: `${mouthAnchor.top}%`,
            width: `${mouthAnchor.width}%`,
            height: `${0.12 + mouthOpen * 0.62}rem`,
          }}
        />
      </div>
    </div>
  );
}
