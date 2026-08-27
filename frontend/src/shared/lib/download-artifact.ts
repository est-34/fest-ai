"use client";

/**
 * 서버가 job 결과에 실어 보내는 파일 산출물.
 *
 * 파일 저장소 제공자가 아직 없어서 백엔드는 URL 대신 base64 바이트를 그대로 내려준다
 * (ESG 보고서 PDF/DOCX, 운영 데이터 CSV/JSON 모두 같은 모양이다).
 */
export interface JobArtifact {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  byteSize: number;
  /** PDF는 한글이 표준 폰트 밖이라 '?'로 깨진다. 서버가 알려 주면 화면에 그대로 보여 준다. */
  textLossWarning?: string | null;
}

export interface JobResult {
  artifacts?: JobArtifact[];
  rowCount?: number;
  [key: string]: unknown;
}

/** job 결과에서 첫 산출물을 꺼낸다. 아직 없으면 undefined(생성 중이거나 실패). */
export function artifactOf(result: JobResult | null | undefined) {
  return result?.artifacts?.[0];
}

function bytesOf(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 브라우저에 파일로 저장시킨다. 산출물이 base64라 blob으로 바꿔 임시 URL을 만든다. */
export function downloadArtifact(artifact: JobArtifact) {
  const blob = new Blob([bytesOf(artifact.contentBase64)], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.fileName;
  link.click();
  // 클릭 직후에 해제하면 일부 브라우저가 저장을 시작하기 전에 URL이 사라진다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(byteSize: number) {
  if (byteSize < 1024) return `${byteSize}B`;
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)}KB`;
  return `${(byteSize / 1024 / 1024).toFixed(1)}MB`;
}
