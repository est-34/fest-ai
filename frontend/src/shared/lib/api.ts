const API_BASE = "/api/backend";

export const FESTIVAL_CODE = process.env.NEXT_PUBLIC_FESTIVAL_CODE ?? "EST34-2026";

interface ApiEnvelope<T> {
  data: T;
  page?: PageInfo;
}

/** 목록 응답의 커서 페이지네이션 정보. 커서는 서버가 만든 불투명한 값이다. */
export interface PageInfo {
  nextCursor: string | null;
  hasNext: boolean;
  limit: number;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

const ADMIN_ACCESS = "festai-admin-access";
const ADMIN_REFRESH = "festai-admin-refresh";
const VISITOR_TOKEN = "festai-visitor-token";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** 응답 봉투를 그대로 돌려주는 호출. page(커서)까지 필요한 목록만 이쪽을 쓴다. */
async function apiEnvelope<T>(path: string, init: RequestInit = {}, token?: string): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
    throw new ApiError(body.error?.message ?? "서버 요청을 처리하지 못했어요.", response.status);
  }
  if (response.status === 204) return { data: undefined as T };
  return (await response.json()) as ApiEnvelope<T>;
}

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  return (await apiEnvelope<T>(path, init, token)).data;
}

export function publicApi<T>(path: string, init?: RequestInit) {
  return api<T>(path, init);
}

let visitorSession: Promise<string> | undefined;
let visitorGeneration = 0;

// 세션이 재발급되면 이전 세션에 매달린 서버 리소스(AI 대화 등)는 더 이상 쓸 수 없다.
export function visitorSessionGeneration() {
  return visitorGeneration;
}

function visitorToken(): Promise<string> {
  const stored = localStorage.getItem(VISITOR_TOKEN);
  if (stored) return Promise.resolve(stored);
  visitorSession ??= api<{ sessionToken: string }>(
    `/public/festivals/${FESTIVAL_CODE}/visitor-sessions`,
    json("POST", { language: "ko", accessibilityPreferences: {}, consents: {} }),
  ).then(({ sessionToken }) => {
    visitorGeneration += 1;
    localStorage.setItem(VISITOR_TOKEN, sessionToken);
    return sessionToken;
  }).finally(() => { visitorSession = undefined; });
  return visitorSession;
}

async function withVisitorToken<T>(call: (token: string) => Promise<T>): Promise<T> {
  let token = await visitorToken();
  try {
    return await call(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    localStorage.removeItem(VISITOR_TOKEN);
    token = await visitorToken();
    return call(token);
  }
}

export function visitorApi<T>(path: string, init?: RequestInit): Promise<T> {
  return withVisitorToken((token) => api<T>(path, init, token));
}

export function visitorApiPaged<T>(path: string): Promise<ApiEnvelope<T>> {
  return withVisitorToken((token) => apiEnvelope<T>(path, undefined, token));
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

function storeAdminTokens(result: { accessToken: string; refreshToken: string }) {
  localStorage.setItem(ADMIN_ACCESS, result.accessToken);
  localStorage.setItem(ADMIN_REFRESH, result.refreshToken);
}

function persistAdminSession(result: { accessToken: string; refreshToken: string }) {
  adminSessionGeneration += 1;
  adminFestival = undefined;
  adminOrganization = undefined;
  storeAdminTokens(result);
}

export async function loginAdmin(email: string, password: string) {
  const result = await api<LoginResult>("/auth/login", json("POST", { email, password }));
  persistAdminSession(result);
  return result.user;
}

/** BIZ-05 상인 계정 초대. 링크를 연 화면이 어떤 업체·이메일의 초대인지 보여주기 위한 조회. */
export interface MerchantInvitePreview {
  email: string;
  businessName: string;
  festivalName: string;
  expiresAt: string;
  /** 이미 계정이 있으면 비밀번호를 다시 받지 않고 업체 연결만 늘린다. */
  hasAccount: boolean;
}

export function lookupMerchantInvitation(token: string) {
  return api<MerchantInvitePreview>("/auth/merchant-invitations/lookup", json("POST", { token }));
}

/** 초대 수락 = 상인 계정 발급과 업체 연결. 수락 즉시 로그인 상태가 되도록 토큰을 보관한다. */
export async function acceptMerchantInvitation(input: { token: string; password?: string; name?: string }) {
  const result = await api<LoginResult & { businessName: string }>(
    "/auth/merchant-invitations/accept",
    json("POST", input),
  );
  persistAdminSession(result);
  return result;
}

function clearAdminSession() {
  adminFestival = undefined;
  adminOrganization = undefined;
  localStorage.removeItem(ADMIN_ACCESS);
  localStorage.removeItem(ADMIN_REFRESH);
  localStorage.removeItem("festai-admin-festival-id"); // 예전 버전이 남긴 캐시 정리
}

export async function logoutAdmin() {
  const refreshToken = localStorage.getItem(ADMIN_REFRESH);
  adminSessionGeneration += 1;
  try {
    if (refreshToken) {
      await api<void>("/auth/logout", json("POST", { refreshToken }));
    }
  } finally {
    clearAdminSession();
  }
}

let adminRefresh: Promise<string> | undefined;
let adminSessionGeneration = 0;

function refreshAdminToken() {
  if (adminRefresh) return adminRefresh;
  const generation = adminSessionGeneration;
  const refresh = (async () => {
    const refreshToken = localStorage.getItem(ADMIN_REFRESH);
    if (!refreshToken) throw new ApiError("로그인이 필요해요.", 401);
    const result = await api<{ accessToken: string; refreshToken: string }>("/auth/refresh", json("POST", { refreshToken }));
    if (generation !== adminSessionGeneration) throw new ApiError("로그인이 필요해요.", 401);
    storeAdminTokens(result);
    return result.accessToken;
  })().catch((error) => {
    if (generation === adminSessionGeneration) clearAdminSession();
    throw error;
  }).finally(() => {
    if (adminRefresh === refresh) adminRefresh = undefined;
  });
  adminRefresh = refresh;
  return refresh;
}

/** 액세스 토큰을 붙여 호출하고, 401이면 한 번만 갱신해 다시 시도한다. */
async function withAdminToken<T>(call: (token: string) => Promise<T>): Promise<T> {
  const token = localStorage.getItem(ADMIN_ACCESS) ?? (await refreshAdminToken());
  try {
    return await call(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    // 다른 요청이 이미 새 토큰을 받아 뒀으면 그것을 쓰고, 아니면 직접 갱신한다.
    const latestToken = localStorage.getItem(ADMIN_ACCESS);
    return call(latestToken && latestToken !== token ? latestToken : await refreshAdminToken());
  }
}

export function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  return withAdminToken((token) => api<T>(path, init, token));
}

export function currentAdmin() {
  return adminApi<{ id: string; email: string; name: string; role: string; organizationId: string; festivalScope: string[] }>("/me");
}

// 축제 ID는 localStorage에 남기지 않는다 — 오래된 캐시로 다른 축제의 데이터를 바꾸는 사고를 막기 위해
// 페이지 로드마다 접근 가능한 축제 목록에서 코드가 정확히 일치하는 축제를 다시 확인한다.
let adminFestival: Promise<string> | undefined;
let adminOrganization: Promise<string> | undefined;

/** 조직 ID는 세션당 한 번만 조회한다. 멤버십 API가 호출마다 /me를 다시 부르지 않도록. */
export function adminOrganizationId() {
  adminOrganization ??= currentAdmin()
    .then((admin) => admin.organizationId)
    .catch((error) => {
      adminOrganization = undefined;
      throw error;
    });
  return adminOrganization;
}

export function adminFestivalId() {
  adminFestival ??= (async () => {
    const festivals = await adminApi<{ id: string; code: string }[]>("/admin/festivals");
    const festival = festivals.find((item) => item.code === FESTIVAL_CODE);
    if (!festival) {
      throw new ApiError(`축제 코드 ${FESTIVAL_CODE}에 해당하는 축제에 접근할 수 없습니다. 관리자 계정 권한과 축제 코드 설정을 확인해주세요.`, 403);
    }
    return festival.id;
  })().catch((error) => {
    adminFestival = undefined;
    throw error;
  });
  return adminFestival;
}

/** `/admin/festivals/{현재 축제}` 하위 경로 호출. 축제 ID 조회를 호출부마다 반복하지 않는다. */
export async function festivalApi<T>(path = "", init?: RequestInit): Promise<T> {
  return adminApi<T>(`/admin/festivals/${await adminFestivalId()}${path}`, init);
}

/**
 * data와 함께 page(커서)까지 필요한 목록용. 일반 호출은 envelope의 data만 꺼내 쓰기 때문에
 * nextCursor가 그대로 버려진다 — 다음 페이지를 요청하려면 이쪽을 써야 한다.
 */
export async function festivalApiPaged<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const festivalId = await adminFestivalId();
  return withAdminToken((token) => apiEnvelope<T>(`/admin/festivals/${festivalId}${path}`, init, token));
}

/**
 * 커서를 끝까지 따라가 목록 전체를 모은다.
 *
 * 운영 화면은 상태 탭·필터를 클라이언트에서 걸기 때문에 한 페이지만 받으면 뒤쪽 데이터가
 * 조용히 사라진다(서버가 100건에서 자른다). 페이지 수에 상한을 둬서, 데이터가 예상보다
 * 많을 때 브라우저가 무한정 요청하는 일은 막는다.
 */
export async function collectPages<T>(
  load: (cursor?: string) => Promise<ApiEnvelope<T[]>>,
  { maxPages = Infinity, repeatedCursorError }: { maxPages?: number; repeatedCursorError?: string } = {},
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await load(cursor);
    rows.push(...result.data);
    if (!result.page?.hasNext || !result.page.nextCursor) break;
    const next = result.page.nextCursor;
    if (repeatedCursorError && next === cursor) throw new Error(repeatedCursorError);
    cursor = next;
  }
  return rows;
}

export function festivalApiAll<T>(path: string, { maxPages = 10, limit = 100 } = {}): Promise<T[]> {
  return collectPages<T>((cursor) => {
    const separator = path.includes("?") ? "&" : "?";
    const query = `${separator}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    return festivalApiPaged<T[]>(`${path}${query}`);
  }, { maxPages });
}

export interface PasswordChangeResult {
  accessToken: string;
  refreshToken: string;
}

/** 본인 비밀번호 변경. 서버가 기존 리프레시 토큰을 모두 폐기하므로 새 토큰 쌍을 받아 갈아끼운다. */
export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const result = await adminApi<PasswordChangeResult>("/me/password", json("POST", { currentPassword, newPassword }));
  storeAdminTokens(result);
  return result;
}

/**
 * 멱등키. crypto.randomUUID는 보안 컨텍스트(https·localhost)에서만 존재해서, 현장에서
 * 폰이 http://<LAN IP>로 접속하면 예약·쿠폰 발급·스탬프가 전부 TypeError로 죽었다.
 * (이 모듈은 표시용 유틸리티에 의존하지 않는다.)
 */
export function idempotencyKey() {
  return crypto.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** JSON 본문 요청 init. `{ method, body: JSON.stringify(...) }` 반복을 줄인다. */
export function json(method: "POST" | "PATCH" | "PUT" | "DELETE", body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

/**
 * 멱등키를 붙인 요청 init. 버튼 연타로 예약·발급·적립이 두 번 일어나는 것을 서버가 막는다.
 * 본문이 없는 발급 요청(POST .../issues)도 있어 body는 선택이다.
 */
export function idempotent(method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): RequestInit {
  return {
    method,
    headers: { "Idempotency-Key": idempotencyKey() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
