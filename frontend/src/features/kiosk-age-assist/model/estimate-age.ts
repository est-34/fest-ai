/**
 * KIOSK-A11Y-01 기기 내 연령대 추정.
 *
 * 카메라 프레임은 이 모듈 밖으로 나가지 않는다. 모델 가중치는 /public/models에 함께 배포해
 * 외부 호출 없이 브라우저 안에서만 돌고, 호출부에는 추정 나이가 아니라 "고령층 가능성"
 * 판정만 돌려준다 — 나이 값을 넘기면 어딘가에 저장되거나 다른 판단에 쓰이기 쉽다
 * (ESG-G-08: 추정 결과를 가격·입장·자격·추천 우선순위에 사용 금지).
 *
 * 원본 영상·얼굴 이미지·특징값은 저장하지 않고, 판정 직후 트랙을 끄고 요소를 버린다.
 */
import { loadFaceApi } from "@/shared/lib/face-api";

/** 어떤 모델의 판정인지 지표에 남긴다(ESG-G-08 편향·오탐 점검). */
export const AGE_MODEL_VERSION = "face-api/tiny_face_detector+age_gender@1.7.15";

/** 검출 신뢰도가 이보다 낮은 프레임은 나이를 보지 않는다. */
const MIN_DETECTION_SCORE = 0.45;
/**
 * 제안 기준 나이. 실제 고령층을 60대 초반으로 낮게 추정하는 경향이 있어 기준을 60이 아니라
 * 62로 둔다 — 아래로 틀리면 도움이 필요한 사람이 제안을 못 받고, 위로 틀리면 30대에게
 * "큰 글씨로 볼까요?"가 뜬다. 어느 쪽도 좋지 않아 현장 검증 후 조정할 값이다.
 * ponytail: 상수 하나로 둔다. 축제별로 달라져야 하면 그때 설정으로 올린다.
 */
const SENIOR_AGE = 62;
/** 얼굴을 찾을 때까지 볼 프레임 수. 넘어가면 미검출로 끝낸다. */
const MAX_FRAMES = 12;
const FRAME_INTERVAL_MS = 150;
/** 판정에 쓸 검출 수. 한 프레임 추정은 몇 살씩 흔들려 중앙값을 쓴다. */
const SAMPLES = 3;

export type AgeAssistResult =
  /** 고령층 가능성이 높다 — 큰 글씨 모드를 제안한다. */
  | { status: "senior" }
  /** 얼굴은 찾았지만 제안 기준에 못 미친다 — 아무것도 하지 않는다. */
  | { status: "other" }
  /** 미검출·저신뢰도. 제안하지 않는다(완료 기준의 '추정 실패'). */
  | { status: "unavailable" };

/** 화면에 붙이지 않으면 재생되지 않는 브라우저가 있어 보이지 않는 크기로 문서에 넣는다. */
function hiddenVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-1px;top:-1px";
  document.body.append(video);
  return video;
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("카메라 영상 준비 시간이 초과되었습니다."));
    }, 5_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("카메라 영상을 준비하지 못했습니다."));
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });

  // 첫 loadeddata 직후에는 프레임 크기만 있고 실제 영상 프레임이 비어 있을 수 있다.
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

async function openCamera(): Promise<MediaStream> {
  const preferred = {
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  } satisfies MediaStreamConstraints;

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (error) {
    // 키오스크 카메라가 facingMode·해상도 제약을 지원하지 않아도 기본 카메라로 한 번 더 시도한다.
    if (error instanceof DOMException && ["OverconstrainedError", "NotFoundError"].includes(error.name)) {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw error;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function isSeniorAge(ages: number[]): boolean {
  return ages.length >= SAMPLES && median(ages) >= SENIOR_AGE;
}

/**
 * 카메라를 열어 한 사람의 연령대를 추정하고 즉시 닫는다.
 *
 * 호출부는 이 함수를 방문객이 카메라 사용에 동의한 뒤에만 부른다. 권한 거부·카메라 없음·
 * 모델 로드 실패는 모두 "unavailable"로 같게 끝난다 — 어떤 이유든 키오스크는 그대로
 * 쓸 수 있어야 하고, 실패 원인을 방문객에게 물어봐야 할 이유가 없다.
 */
export async function estimateAgeBand(): Promise<AgeAssistResult> {
  let stream: MediaStream | undefined;
  let video: HTMLVideoElement | undefined;
  try {
    const faceapi = await loadFaceApi("ageGenderNet");
    stream = await openCamera();
    video = hiddenVideo();
    video.srcObject = stream;
    await video.play();
    await waitForVideoReady(video);

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: MIN_DETECTION_SCORE });
    const ages: number[] = [];
    for (let frame = 0; frame < MAX_FRAMES && ages.length < SAMPLES; frame += 1) {
      const detection = await faceapi.detectSingleFace(video, options).withAgeAndGender();
      // 성별은 모델이 함께 내지만 쓰지 않고 버린다 — 접근성 제안에 필요하지 않다.
      if (detection) ages.push(detection.age);
      else await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
    }
    if (ages.length < SAMPLES) return { status: "unavailable" };
    return { status: isSeniorAge(ages) ? "senior" : "other" };
  } catch {
    return { status: "unavailable" };
  } finally {
    // 프레임도 스트림도 남기지 않는다. 예외 경로에서도 카메라 표시등이 켜진 채로 두지 않는다.
    stream?.getTracks().forEach((track) => track.stop());
    if (video) {
      video.srcObject = null;
      video.remove();
    }
  }
}
