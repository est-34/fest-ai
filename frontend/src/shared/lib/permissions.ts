export type AdminRole = "SUPER_ADMIN" | "FESTIVAL_MANAGER" | "FIELD_OPERATOR" | "MERCHANT" | "REVIEWER";

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "최고 관리자",
  FESTIVAL_MANAGER: "축제 담당자",
  FIELD_OPERATOR: "현장 운영자",
  MERCHANT: "입점업체",
  REVIEWER: "검수자",
};

export interface AdminNavItem {
  href: string;
  label: string;
  roles: AdminRole[];
  /** 사이드바 섹션 헤더. 생략하면 헤더 없이 최상단에 붙습니다. */
  group?: string;
}

/**
 * 백엔드가 화면 단위 권한 매트릭스를 내려주지 않아, 각 화면이 호출하는 엔드포인트의
 * roles() 가드를 근거로 매핑했습니다. 화면에 필요한 API 중 하나라도 호출할 수 있는
 * 역할을 포함시킵니다. 백엔드 가드가 바뀌면 이 배열도 함께 맞춰야 합니다.
 *
 * 배열 순서 = 사이드바 노출 순서입니다. 축제 기간 중 매일 여는 화면(현장 운영)을 위에,
 * 준비 단계에 한 번 만지는 화면(설정·관리)을 아래에 두고 group으로 묶었습니다.
 * 항목을 추가할 때는 같은 group 블록 안에 넣어야 헤더가 쪼개지지 않습니다.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "운영 대시보드", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR", "REVIEWER"] },

  // crowd-snapshots, bookings/{id}/status → SUPER_ADMIN, FESTIVAL_MANAGER, FIELD_OPERATOR
  { href: "/admin/field", label: "현장 운영", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  // bookings 조회·상태 변경(호출·노쇼·입장)은 현장에서 처리하므로 현장 운영자까지 포함한다.
  { href: "/admin/bookings", label: "예약·호출 관리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  { href: "/admin/tickets", label: "민원·공지·사고", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  // coupon-redemptions 는 백엔드에서 Operator(최고 관리자·축제 담당자·현장 운영자) 범위다.
  { href: "/admin/coupons", label: "쿠폰 사용 처리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  { href: "/admin/plogging", label: "플로깅 인증", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  { href: "/admin/reusable-containers", label: "재사용기 회수", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  // staff-assignments 등록은 Manager, 배정 확인은 본인 계정
  { href: "/admin/staff", label: "인력 배치", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },
  { href: "/admin/programs", label: "통합 운영관리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"], group: "현장 운영" },

  // 긴급 안내가 가장 빨리 보이도록 소통 메뉴의 첫 자리에 둔다.
  // 발행 흐름이 content-versions/{id}/reviews(Reviewer)와 announcements/publish(Manager)를
  // 모두 거쳐서 전체를 끝낼 수 있는 건 SUPER_ADMIN 뿐. FESTIVAL_MANAGER는 조회·종료만 된다.
  { href: "/admin/announcements", label: "공지 발행", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "콘텐츠·소통" },
  // content-versions/{id}/reviews → SUPER_ADMIN, REVIEWER
  { href: "/admin/content", label: "검수·게시 관리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "REVIEWER"], group: "콘텐츠·소통" },
  // ai/reviews, ai/reviews/{id}/decision → SUPER_ADMIN, FESTIVAL_MANAGER, REVIEWER
  { href: "/admin/ai-insights", label: "AI 민원 인사이트", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "REVIEWER"], group: "콘텐츠·소통" },
  // surveys 등록·상태 변경은 Manager, 결과 집계 조회는 축제 범위의 모든 역할
  { href: "/admin/surveys", label: "설문 관리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "REVIEWER"], group: "콘텐츠·소통" },
  // internal-documents 등록은 Manager, ai/operations/search는 로그인한 모든 역할
  { href: "/admin/documents", label: "운영 문서·검색", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR", "REVIEWER"], group: "콘텐츠·소통" },

  // esg/measurements/{id}/reviews, esg/reports/{id}/approve → SUPER_ADMIN, REVIEWER
  { href: "/admin/esg", label: "ESG 성과관리", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "REVIEWER"], group: "ESG" },
  // reward-campaigns → SUPER_ADMIN, FESTIVAL_MANAGER
  { href: "/admin/rewards", label: "ESG 리워드", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "ESG" },

  // festivals PATCH·clone, facilities CRUD → SUPER_ADMIN, FESTIVAL_MANAGER
  { href: "/admin/festival", label: "축제 설정", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "설정·관리" },
  // areas CRUD → SUPER_ADMIN, FESTIVAL_MANAGER
  { href: "/admin/map-locations", label: "지도·부스 설정", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "설정·관리" },
  // businesses/{id}/review → SUPER_ADMIN, FESTIVAL_MANAGER, REVIEWER / 쿠폰 발행은 Manager
  { href: "/admin/businesses", label: "참여업체·쿠폰", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER", "REVIEWER"], group: "설정·관리" },
  // organizations/{id}/memberships → SUPER_ADMIN 전용
  { href: "/admin/members", label: "계정·권한", roles: ["SUPER_ADMIN"], group: "설정·관리" },
  // privacy/policy·requests는 Manager, privacy/purge는 SUPER_ADMIN 전용(화면에서 버튼만 감춘다).
  { href: "/admin/privacy", label: "개인정보·전달", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "설정·관리" },
  { href: "/admin/audit-logs", label: "감사 로그", roles: ["SUPER_ADMIN", "FESTIVAL_MANAGER"], group: "설정·관리" },
];

/**
 * 긴급(EMERGENCY) 공지는 방문객 화면 상단에 강제로 고정되고 되돌리기 어려워, 일반 공지와
 * 같은 권한으로 두지 않는다. 발행 6단계(검수 승인 포함)를 혼자 끝낼 수 있는 최고 관리자만
 * 긴급도로 발행할 수 있고, 축제 담당자는 일반·주의 공지까지만 발행한다.
 */
const EMERGENCY_PUBLISH_ROLES: AdminRole[] = ["SUPER_ADMIN"];

export function canPublishEmergency(role: string | undefined) {
  return role !== undefined && (EMERGENCY_PUBLISH_ROLES as string[]).includes(role);
}

/**
 * 사이드바에 없는 보호 화면. 참여업체 콘솔은 nav 항목이 아니라서 canAccessPath가
 * "모르는 경로"로 보고 통과시켰고, 현장 운영자·검수자도 화면에 들어가 API 403만
 * 잔뜩 보게 됐다. 여기에 적어 두면 나머지 화면과 같은 규칙으로 막힌다.
 */
const EXTRA_PROTECTED_PATHS: { href: string; roles: AdminRole[] }[] = [
  { href: "/merchant", roles: ["MERCHANT", "SUPER_ADMIN"] },
];

export function findNavItem(pathname: string) {
  return ADMIN_NAV_ITEMS.find((item) => (item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href)));
}

export function canAccessPath(role: string | undefined, pathname: string) {
  const item = findNavItem(pathname) ?? EXTRA_PROTECTED_PATHS.find((entry) => pathname.startsWith(entry.href));
  if (!item) return true;
  if (!role) return false;
  return (item.roles as string[]).includes(role);
}

export function visibleNavItems(role: string | undefined) {
  return ADMIN_NAV_ITEMS.filter((item) => role !== undefined && (item.roles as string[]).includes(role));
}

/**
 * 축제 기간에 현장에서 폰으로 여는 화면. 사이드바는 lg 이상에서만 보이고 모바일에서는
 * 접힌 그룹 안에 있어 두 번 눌러야 닿아서, 이 다섯 개만 하단 탭으로 따로 뺍니다.
 * 순서 = 탭 순서. 권한이 없는 항목은 빠지므로 역할에 따라 개수가 줄어듭니다.
 */
const MOBILE_NAV_HREFS = ["/admin", "/admin/field", "/admin/bookings", "/admin/coupons", "/admin/tickets"];

export function mobileNavItems(role: string | undefined) {
  const items = MOBILE_NAV_HREFS.map((href) => ADMIN_NAV_ITEMS.find((item) => item.href === href)).filter(
    (item): item is AdminNavItem => item !== undefined && role !== undefined && (item.roles as string[]).includes(role),
  );
  // 검수자처럼 현장 화면이 거의 없는 역할에 탭 하나짜리 바를 띄우면 자리만 먹는다.
  return items.length < 2 ? [] : items;
}
