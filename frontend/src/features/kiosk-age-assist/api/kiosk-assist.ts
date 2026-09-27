import { FESTIVAL_CODE, json, publicApi, visitorApi } from "@/shared/lib/api";

/**
 * KIOSK-A11Y-01 익명 효과 지표. 이벤트 종류와 모델 버전만 보낸다 —
 * 추정 나이·신뢰도·프레임은 서버 스키마에 필드 자체가 없다(ESG-G-08).
 */
export type KioskAssistEvent =
  | "CONSENT_SHOWN"
  | "CONSENT_GRANTED"
  | "CONSENT_DECLINED"
  | "ESTIMATE_FAILED"
  | "ESTIMATE_RESULT"
  | "SUGGESTED"
  | "ACCEPTED"
  | "DISMISSED"
  | "MANUAL_LARGE_TEXT"
  | "TASK_COMPLETED";

export type KioskAssistResult = "SENIOR" | "OTHER" | "UNAVAILABLE";

export function recordKioskAssist(
  eventType: KioskAssistEvent,
  modelVersion?: string,
  result?: KioskAssistResult,
) {
  // 지표 전송 실패로 방문객 화면이 막히면 안 된다. 조용히 버린다.
  return visitorApi("/visitor/kiosk-assist-events", json("POST", { eventType, modelVersion, result })).catch(() => undefined);
}

/**
 * ESG-G-08 중지 스위치. 꺼져 있으면 카메라 제안을 아예 만들지 않는다.
 *
 * 축제 공개 정보는 120초 캐시가 붙어 있어 그대로 쓰면 운영자가 중지를 눌러도 이미 응답을
 * 받아 둔 키오스크가 그동안 계속 카메라를 권한다. 중지는 안전 장치라 캐시를 끊고 받는다.
 */
export async function fetchKioskCameraEnabled(): Promise<boolean> {
  try {
    const festival = await publicApi<{ kioskCameraEnabled?: boolean }>(
      `/public/festivals/${FESTIVAL_CODE}`, { cache: "no-store" });
    // 구버전 백엔드는 이 선택적 필드를 아직 보내지 않는다. 명시적으로 false일 때만
    // 운영자 중지 스위치로 보고, 필드 누락·일시적 조회 실패는 온디바이스 기능을 막지 않는다.
    return festival.kioskCameraEnabled !== false;
  } catch {
    return true;
  }
}
