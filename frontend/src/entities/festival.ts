import { fetchPublicFestival, type PublicTransport } from "@/shared/lib/public-festival";
import { FESTIVAL_CODE, publicApi } from "@/shared/lib/api";
import { BCP47_BY_LOCALE, dictionaries, type Locale } from "@/shared/lib/i18n";
import { translateEntries, translateFields } from "@/shared/lib/i18n/translate-client";

export interface FestivalInfo {
  id: string;
  name: string;
  subtitle: string;
  location: string;
  period: { start: string; end: string };
  hours: string;
  organizer: string;
  approvedAt: string;
  // 운영자가 축제 정보를 마지막으로 고친 시각(ISO). 방문객 화면의 "최종 갱신"에 그대로 쓴다.
  updatedAt: string;
  description: string;
}

export interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  title: string;
  stage: string;
  category: "공연" | "체험" | "전시" | "푸드" | "행사";
}

export interface FacilityInfo {
  id: string;
  name: string;
  type: "화장실" | "주차장" | "구급실" | "안내소" | "수유실" | "물품보관소";
  location: string;
  status: string;
  operatingHours: Record<string, string> | null;
  accessibility: Record<string, boolean> | null;
}

export interface TransportOption extends PublicTransport {
  id: string;
}

// 랜딩 페이지(/)는 백엔드가 죽어도 떠야 한다. 실제 값은 fetchLandingFestival()이 덮어쓰고,
// 이 상수는 조회에 실패했을 때만 쓰는 마지막 안전망이다.
export const festivalInfo: FestivalInfo = {
  id: "greenhan-2026",
  name: "2026 그린한강 페스티벌",
  subtitle: "AI와 ESG가 함께 만드는 지속가능한 강변축제",
  location: "서울 영등포구 여의도한강공원 물빛광장 일대",
  period: { start: "2026-09-18", end: "2026-09-20" },
  hours: "매일 11:00 - 22:00",
  organizer: "영등포구청 축제운영과",
  approvedAt: "2026-08-01",
  updatedAt: "2026-08-01T09:00:00+09:00",
  description:
    "다회용기·분리배출·대중교통 이용을 장려하는 친환경 축제로, 지역 소상공인과 함께 성장하는 지속가능한 지역축제를 지향합니다.",
};

/**
 * 교통 안내. 운영자가 축제 설정에서 등록한 값을 그대로 쓴다.
 *
 * 예전에는 이 파일에 박아 둔 여의도 데모 데이터라, 다른 축제를 올려도 화면에는 계속
 * 남의 축제 교통편이 나왔다(운영자가 고칠 방법도 없었다).
 */
export async function fetchTransport(locale: Locale = "ko", load = fetchPublicFestival): Promise<TransportOption[]> {
  const festival = await load();
  const options = (festival.transport ?? []).map((option, index) => ({ ...option, id: `transport-${index}` }));
  return translateFields(options, ["label", "detail"], locale);
}

export async function fetchFestivalInfo(locale: Locale = "ko", load = fetchPublicFestival): Promise<FestivalInfo> {
  const festival = await load();
  const text = dictionaries[locale].festivalData;
  const translated = await translateEntries({ name: festival.name, description: festival.description }, locale);
  return {
    id: festival.id,
    name: translated.name ?? festival.name,
    subtitle: translated.description ?? festival.description,
    location: text.fallbackLocation,
    period: { start: festival.startsAt.slice(0, 10), end: festival.endsAt.slice(0, 10) },
    hours: text.fallbackHours,
    organizer: text.fallbackOrganizer,
    approvedAt: festival.updatedAt.slice(0, 10),
    updatedAt: festival.updatedAt,
    description: translated.description ?? festival.description,
  };
}

/** 랜딩 페이지용 축제 정보. 백엔드가 없거나 축제가 비공개면 정적 안내로 대체한다. */
export function fetchLandingFestival(): Promise<FestivalInfo> {
  return fetchFestivalInfo("ko").catch(() => festivalInfo);
}

export async function fetchSchedule(locale: Locale = "ko") {
  const programs = await publicApi<Array<{
    id: string; title: string; category: string;
    sessions: Array<{ id: string; startsAt: string; area: { name: string } }>;
  }>>(`/public/festivals/${FESTIVAL_CODE}/programs?status=OPEN`);
  const categories: Record<string, ScheduleItem["category"]> = {
    performance: "공연", experience: "체험", exhibition: "전시", food: "푸드", event: "행사",
  };
  const bcp47 = BCP47_BY_LOCALE[locale];
  const items = programs.flatMap((program) => program.sessions.map((session) => {
    const startsAt = new Date(session.startsAt);
    return {
      id: session.id,
      day: startsAt.toLocaleDateString(bcp47, { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }),
      time: startsAt.toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }),
      title: program.title,
      stage: session.area.name,
      category: categories[program.category] ?? "행사",
    } satisfies ScheduleItem;
  }));
  return translateFields(items, ["title", "stage"], locale);
}

export async function fetchFacilities(locale: Locale = "ko") {
  const rows = await publicApi<Array<{
    id: string; name: string; facilityType: string; status: string; area: { name: string };
    operatingHours: Record<string, string> | null; accessibility: Record<string, boolean> | null;
  }>>(`/public/festivals/${FESTIVAL_CODE}/facilities`);
  const types: Record<string, FacilityInfo["type"]> = {
    RESTROOM: "화장실", PARKING: "주차장", FIRST_AID: "구급실", INFO: "안내소", NURSING_ROOM: "수유실", STORAGE: "물품보관소",
  };
  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: types[row.facilityType] ?? "안내소",
    location: row.area.name,
    status: row.status,
    operatingHours: row.operatingHours,
    accessibility: row.accessibility,
  } satisfies FacilityInfo));
  return translateFields(items, ["name", "location"], locale);
}
