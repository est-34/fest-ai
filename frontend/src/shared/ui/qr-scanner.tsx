"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/shared/ui/button";

// BarcodeDetector는 아직 표준 타입에 없다. 지원 여부를 런타임에 확인하고 쓰는 최소 선언만 둔다.
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function barcodeDetector(): BarcodeDetectorConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/**
 * 카메라로 QR을 읽는다. BarcodeDetector를 지원하지 않는 브라우저(사파리 등)에서는
 * 아예 그리지 않고, 호출부의 코드 직접 입력만 남긴다.
 *
 * 쿠폰 사용 처리와 스탬프 현장 인증이 같은 동작을 쓰므로 라벨만 호출부가 정한다.
 */
export function QrScanner({ onScan, label = "카메라로 QR 스캔" }: { onScan: (value: string) => void; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string>();
  const supported = barcodeDetector() !== undefined;

  useEffect(() => {
    if (!active) return;
    const Detector = barcodeDetector();
    if (!Detector) return;

    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    const detector = new Detector({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const [first] = await detector.detect(videoRef.current);
            if (first?.rawValue) {
              onScan(first.rawValue);
              setActive(false);
              return;
            }
          } catch {
            // 한 프레임 인식 실패는 무시하고 다음 프레임을 본다.
          }
          timer = window.setTimeout(tick, 400);
        };
        void tick();
      } catch {
        setError("카메라를 열지 못했어요. 권한을 확인하거나 코드를 직접 입력해 주세요.");
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, onScan]);

  if (!supported) return null;

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setActive((value) => !value)}>
        {active ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
        {active ? "스캔 중지" : label}
      </Button>
      {active && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="aspect-video w-full max-w-sm rounded-xl border border-border bg-black object-cover"
        />
      )}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
