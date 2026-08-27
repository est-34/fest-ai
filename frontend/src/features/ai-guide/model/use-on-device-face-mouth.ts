"use client";

import { useEffect, useState } from "react";
import { loadFaceApi } from "@/shared/lib/face-api";

export interface MouthAnchor {
  left: number;
  top: number;
  width: number;
}

const DEFAULT_ANCHOR: MouthAnchor = { left: 50, top: 35.5, width: 12 };

type ElementRef<T> = { current: T | null };

function toPercent(value: number, total: number) {
  return Math.max(0, Math.min(100, (value / total) * 100));
}

/**
 * 사진의 입 위치를 브라우저에서만 찾는다.
 * 서버로 사진·랜드마크·특징값을 전송하지 않고, 화면에 표시할 좌표만 반환한다.
 */
export function useOnDeviceFaceMouth(
  imageRef: ElementRef<HTMLImageElement>,
  stageRef: ElementRef<HTMLDivElement>,
) {
  const [mouthAnchor, setMouthAnchor] = useState<MouthAnchor>(DEFAULT_ANCHOR);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    async function detect() {
      const image = imageRef.current;
      const stage = stageRef.current;
      if (!image || !stage || !image.complete || !image.naturalWidth || !stage.clientWidth) {
        retryTimer = window.setTimeout(detect, 250);
        return;
      }

      try {
        const faceapi = await loadFaceApi("faceLandmark68TinyNet");
        if (cancelled) return;
        const detection = await faceapi
          .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks(true);
        if (!detection || cancelled) return;

        const mouth = detection.landmarks.getMouth();
        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;
        const scale = Math.max(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
        // Perso 이미지의 object-position이 center 10%이므로 사진이 잘린 만큼 같은
        // 오프셋을 적용해 랜드마크와 화면 레이어를 일치시킨다.
        const offsetX = (stageWidth - image.naturalWidth * scale) * 0.5;
        const offsetY = (stageHeight - image.naturalHeight * scale) * 0.1;
        const x = mouth.reduce((sum, point) => sum + point.x, 0) / mouth.length;
        const y = mouth.reduce((sum, point) => sum + point.y, 0) / mouth.length;
        const minX = Math.min(...mouth.map((point) => point.x));
        const maxX = Math.max(...mouth.map((point) => point.x));

        setMouthAnchor({
          left: toPercent(x * scale + offsetX, stageWidth),
          top: toPercent(y * scale + offsetY, stageHeight),
          width: Math.max(7, Math.min(18, ((maxX - minX) * scale / stageWidth) * 100 * 1.35)),
        });
      } catch {
        // 얼굴 랜드마크를 읽지 못해도 기본 좌표와 음성 애니메이션으로 계속 안내한다.
      }
    }

    void detect();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [imageRef, stageRef]);

  return mouthAnchor;
}
