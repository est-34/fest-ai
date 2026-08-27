// 축제 운영 안내데스크 연락처. AI가 검증된 근거로 답하지 못했을 때 방문객을 사람에게
// 연결하는 대체 채널이라, 축제마다 달라질 수 있어 환경변수로 뺐다.
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "02-2670-3114";

// tel: 링크는 하이픈·공백을 빼야 일부 단말에서 정상 동작한다.
export const SUPPORT_PHONE_HREF = `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`;
