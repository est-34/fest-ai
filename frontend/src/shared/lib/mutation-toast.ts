export interface MutationToastMeta {
  success?: string;
  silent?: boolean;
}

/**
 * 쓰기 동작의 결과 알림을 띄울지, 뭐라고 띄울지 정한다. providers.tsx의 mutation cache가 쓴다.
 * - silent: 결과가 화면에 바로 드러나는 곳(검색 등)은 알리지 않는다.
 * - 실패는 어디서든 알린다. 조용히 실패하는 게 제일 나쁘다.
 * - 성공은 문구가 지정됐거나 관리자 콘솔일 때만. 방문객 화면은 쓰기가 곧 화면 변화라 소음이 된다.
 */
export function mutationToast(
  outcome: "success" | "error",
  meta: MutationToastMeta | undefined,
  pathname: string,
  errorMessage: string,
): { message: string; tone: "success" | "error" } | null {
  if (meta?.silent) return null;
  if (outcome === "error") return { message: errorMessage, tone: "error" };
  if (!meta?.success && !pathname.startsWith("/admin")) return null;
  return { message: meta?.success ?? "처리했어요.", tone: "success" };
}
