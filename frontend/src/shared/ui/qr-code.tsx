"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/shared/lib/utils";

/**
 * 쿠폰 사용 코드를 QR로 그린다. 생성이 실패해도 코드 문자열은 화면에 남아 있어야 하므로
 * (현장 직원이 수동으로 입력할 수 있어야 한다) 실패는 조용히 숨기고 호출부가 코드를 함께 보여준다.
 */
export function QrCode({
  value,
  size = 176,
  alt,
  className,
}: {
  value: string;
  size?: number;
  alt: string;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn("rounded-xl border border-dashed border-border bg-muted", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data: URL이라 next/image 최적화 대상이 아니다.
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-xl bg-white p-1.5", className)}
    />
  );
}
