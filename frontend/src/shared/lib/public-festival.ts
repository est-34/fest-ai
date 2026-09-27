import { FESTIVAL_CODE, publicApi } from "./api";

export interface PublicTransport {
  mode: "지하철" | "버스" | "셔틀" | "주차" | "자전거" | "도보";
  label: string;
  detail: string;
  status: "원활" | "보통" | "혼잡" | "지연";
}

export interface PublicFestival {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  supportedLanguages: string[];
  defaultLanguage: string;
  visitorMenus?: Record<string, boolean>;
  transport?: PublicTransport[];
}

export const PUBLIC_FESTIVAL_KEY = ["public-festival", FESTIVAL_CODE] as const;
export function fetchPublicFestival() {
  return publicApi<PublicFestival>(`/public/festivals/${FESTIVAL_CODE}`);
}
