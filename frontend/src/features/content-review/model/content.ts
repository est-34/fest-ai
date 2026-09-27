export type ContentVersionStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export type ContentAction = "SUBMIT" | "REVIEW" | "PUBLISH" | "UNPUBLISH";

export function contentAction(status: ContentVersionStatus, isPublished: boolean): ContentAction | undefined {
  if (isPublished) return "UNPUBLISH";
  if (status === "DRAFT") return "SUBMIT";
  if (status === "IN_REVIEW") return "REVIEW";
  if (status === "APPROVED") return "PUBLISH";
}

export function contentPreview(body: Record<string, unknown>) {
  for (const key of ["title", "name", "summary", "description"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "본문 미리보기가 없습니다.";
}
