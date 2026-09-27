/**
 * 브라우저에서만 도는 얼굴 검출 모델 로더.
 *
 * 키오스크 연령대 추정과 AI 안내 아바타가 각자 같은 로더를 들고 있었다(모델 URI·실패 시
 * 재시도 규칙 포함). 쓰는 net만 다르므로 net 조합을 인자로 받고 조합별로 한 번만 받는다.
 */
type FaceApi = typeof import("@vladmandic/face-api");
type NetName = "ageGenderNet" | "faceLandmark68TinyNet";

const MODEL_URI = "/models";
const loading = new Map<string, Promise<FaceApi>>();

/** 검출기(tinyFaceDetector)와 요청한 net을 함께 받는다. 실패하면 다음 호출에서 다시 받는다. */
export function loadFaceApi(...nets: NetName[]): Promise<FaceApi> {
  const key = nets.join();
  const pending = loading.get(key) ?? import("@vladmandic/face-api")
    .then(async (faceapi) => {
      await Promise.all([faceapi.nets.tinyFaceDetector, ...nets.map((name) => faceapi.nets[name])]
        .map((net) => net.loadFromUri(MODEL_URI)));
      return faceapi;
    })
    .catch((error) => {
      loading.delete(key);
      throw error;
    });
  loading.set(key, pending);
  return pending;
}
