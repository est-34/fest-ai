import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, test } from "node:test";
import ts from "typescript";

const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

// `imports`로 `@/...` 별칭을 이미 만들어 둔 모듈 URL에 연결하면 같은 모듈 인스턴스를 공유한다.
async function transpile(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) output = output.replaceAll(`"${specifier}"`, `"${url}"`);
  return moduleUrl(output);
}

async function importTypeScript(path, imports) {
  return import(await transpile(path, imports));
}

const apiUrl = await transpile("../src/shared/lib/api.ts");
const { adminApi, adminFestivalId, festivalApi, json, logoutAdmin } = await import(apiUrl);
const localStoreUrl = await transpile("../src/shared/lib/local-store.ts");
const { readJson, writeJson } = await import(localStoreUrl);
const translateClientUrl = await transpile("../src/shared/lib/i18n/translate-client.ts");
const surveyStoreLinkUrl = await transpile("../src/shared/lib/survey-store-link.ts");
const { generateReply } = await importTypeScript("../src/features/ai-guide/lib/generate-reply.ts", {
  "@/shared/lib/api": apiUrl,
  "@/shared/lib/i18n": moduleUrl('export const BCP47_BY_LOCALE = { ko: "ko-KR" };'),
  "@/shared/lib/i18n/translate-client": translateClientUrl,
  "@/shared/lib/local-store": localStoreUrl,
});
const issueAnalysisEntityUrl = await transpile("../src/entities/issue-analysis.ts", {
  "@/shared/lib/api": apiUrl,
});
const issueAnalysisUrl = await transpile("../src/features/complaint-insight/api/issue-analysis.ts", {
  "@/entities/issue-analysis": issueAnalysisEntityUrl,
});
const { rewardActionRule } = await importTypeScript("../src/features/rewards.ts", { "@/shared/lib/api": apiUrl });
const { operatingStatus } = await importTypeScript("../src/features/map/lib/operating-status.ts");
const { datetimeLocal, toIso, toggleValue } = await importTypeScript("../src/shared/lib/utils.ts", {
  clsx: moduleUrl("export const clsx = (...a) => a.join(' ');"),
  "tailwind-merge": moduleUrl("export const twMerge = (v) => v;"),
});
const { isCancelDeadlinePassed } = await importTypeScript("../src/shared/lib/booking-policy.ts");
const { buildImprovementTasks, buildRecurringIssues, buildTopicBreakdown } = await import(issueAnalysisUrl);
// 엔티티는 규칙(model)과 조회(data)가 한 파일이라 조회 쪽 의존성도 함께 연결해 준다.
// 표시 서식은 규칙 테스트와 무관해서 스텁으로 끊는다.
const entity = {
  "@/shared/lib/api": apiUrl,
  "@/shared/lib/i18n/translate-client": translateClientUrl,
  "@/shared/lib/survey-store-link": surveyStoreLinkUrl,
  "@/entities/issue-analysis": issueAnalysisEntityUrl,
  "@/shared/lib/utils": moduleUrl("export const seoulDateTime = String, seoulShort = String, seoulTime = String;"),
};
const { hasSurveyAnswer, surveyQuestionType } = await importTypeScript("../src/entities/visitor.ts", entity);
const { nextTicketStatus } = await importTypeScript("../src/entities/ticket.ts", entity);
const { canClose, validatePublishInput } = await importTypeScript("../src/entities/announcement.ts", entity);
const { contentAction, contentPreview } = await importTypeScript("../src/features/content-review/model/content.ts");
const { ADMIN_NAV_ITEMS, canAccessPath, mobileNavItems, visibleNavItems } = await importTypeScript("../src/shared/lib/permissions.ts");
const { mutationToast } = await importTypeScript("../src/shared/lib/mutation-toast.ts");
const { translateFields } = await importTypeScript("../src/shared/lib/i18n/translate-client.ts");
const { detectLocale } = await importTypeScript("../src/shared/lib/i18n/detect-locale.ts");
// 모델 로더는 브라우저 전용(동적 import)이라 규칙 테스트에서는 끊는다.
const { isSeniorAge } = await importTypeScript("../src/features/kiosk-age-assist/model/estimate-age.ts", {
  "@/shared/lib/face-api": moduleUrl("export const loadFaceApi = () => Promise.reject(new Error('stub'));"),
});

const { QueryClient } = await import("@tanstack/react-query");
const esgUrl = await transpile("../src/entities/esg.ts", { "@/shared/lib/api": apiUrl });
const { fetchEsgMetrics, fetchMetricDefinitions, fetchMeasurements, buildEsgMetrics } = await import(esgUrl);
const publicFestivalUrl = await transpile("../src/shared/lib/public-festival.ts", { "./api": apiUrl });
const { PUBLIC_FESTIVAL_KEY } = await import(publicFestivalUrl);
const { usePublicFestivalLoader } = await importTypeScript("../src/shared/lib/use-public-festival.ts", {
  "./public-festival": publicFestivalUrl,
  "@tanstack/react-query": moduleUrl("export const useQueryClient = () => globalThis.festivalTestClient;"),
});

class MemoryStorage {
  #values = new Map();

  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.get(key) ?? null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(key); }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

const originalFetch = globalThis.fetch;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });

beforeEach(() => localStorage.clear());
after(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  delete globalThis.localStorage;
});

test("JSON 저장은 같은 탭 구독자에게 표준 storage 이벤트로 알린다", () => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage });
  let changes = 0;
  window.addEventListener("storage", () => { changes += 1; });

  writeJson("demo", { ok: true });

  assert.deepEqual(readJson("demo", {}), { ok: true });
  assert.equal(changes, 1);
  delete globalThis.window;
});

test("동시 401 응답은 refresh token을 한 번만 갱신한다", async () => {
  localStorage.setItem("festai-admin-access", "expired-access");
  localStorage.setItem("festai-admin-refresh", "rt_current");
  let refreshCalls = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const authorization = new Headers(init.headers).get("Authorization");
    if (url.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return Response.json({ data: { accessToken: "fresh-access", refreshToken: "rt_next" } });
    }
    if (authorization === "Bearer expired-access") {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return Response.json({ error: { message: "만료됨" } }, { status: 401 });
    }
    return Response.json({ data: url });
  };

  await Promise.all([adminApi("/first"), adminApi("/second")]);
  assert.equal(refreshCalls, 1);
  assert.equal(localStorage.getItem("festai-admin-refresh"), "rt_next");
});

test("로그아웃은 서버 refresh token을 폐기하고 로컬 세션을 지운다", async () => {
  localStorage.setItem("festai-admin-access", "access");
  localStorage.setItem("festai-admin-refresh", "rt_current");
  localStorage.setItem("festai-admin-festival-id", "festival");
  let logoutBody;

  globalThis.fetch = async (_input, init = {}) => {
    logoutBody = JSON.parse(String(init.body));
    return new Response(null, { status: 204 });
  };

  await logoutAdmin();
  assert.deepEqual(logoutBody, { refreshToken: "rt_current" });
  assert.equal(localStorage.length, 0);
});

test("로그아웃 후 늦게 끝난 token refresh는 세션을 복구하지 않는다", async () => {
  localStorage.setItem("festai-admin-access", "expired-access");
  localStorage.setItem("festai-admin-refresh", "rt_current");
  let finishRefresh;
  let notifyRefreshStarted;
  const refreshStarted = new Promise((resolve) => { notifyRefreshStarted = resolve; });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/refresh")) {
      notifyRefreshStarted();
      return new Promise((resolve) => { finishRefresh = resolve; });
    }
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    return Response.json({ error: { message: "만료됨" } }, { status: 401 });
  };

  const request = adminApi("/private");
  await refreshStarted;
  await logoutAdmin();
  finishRefresh(Response.json({ data: { accessToken: "late-access", refreshToken: "rt_late" } }));

  await assert.rejects(request);
  assert.equal(localStorage.length, 0);
});

test("축제 코드가 일치하지 않으면 다른 축제를 대신 선택하지 않는다", async () => {
  localStorage.setItem("festai-admin-access", "access");
  const requests = [];

  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ data: [{ id: "other-festival", code: "OTHER-2026" }] });
  };

  await assert.rejects(adminFestivalId(), /EST34-2026/);
  assert.deepEqual(requests, ["/api/backend/admin/festivals"], "데이터를 바꾸는 요청은 보내지 않는다");
  assert.equal(localStorage.getItem("festai-admin-festival-id"), null, "잘못된 축제 ID를 캐시하지 않는다");
});

test("축제 ID는 접근 가능한 목록에서 확인하고 로그아웃하면 다시 확인한다", async () => {
  localStorage.setItem("festai-admin-access", "access");
  localStorage.setItem("festai-admin-refresh", "rt_current");
  let lookups = 0;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    lookups += 1;
    return Response.json({ data: [{ id: "festival-1", code: "EST34-2026" }] });
  };

  assert.equal(await adminFestivalId(), "festival-1");
  assert.equal(await adminFestivalId(), "festival-1");
  assert.equal(lookups, 1, "같은 세션에서는 한 번만 조회한다");

  await logoutAdmin();
  localStorage.setItem("festai-admin-access", "other-access");
  assert.equal(await adminFestivalId(), "festival-1");
  assert.equal(lookups, 2, "세션이 바뀌면 접근 가능한 축제를 다시 확인한다");
});

test("방문자 세션이 재발급되면 AI 대화를 새로 만들고 404는 한 번만 복구한다", async () => {
  localStorage.setItem("festai-visitor-token", "v1");
  let validToken = "v1";
  let created = 0;
  let answered = 0;
  let alwaysMissing = false;
  const owner = new Map();

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/visitor-sessions")) {
      validToken = "v2";
      return Response.json({ data: { sessionToken: "v2" } });
    }
    if (new Headers(init.headers).get("Authorization") !== `Bearer ${validToken}`) {
      return Response.json({ error: { message: "세션이 만료되었습니다." } }, { status: 401 });
    }
    if (url.endsWith("/visitor/ai/conversations")) {
      created += 1;
      const id = `c${created}`;
      owner.set(id, validToken);
      return Response.json({ data: { id } });
    }
    const conversation = url.match(/conversations\/(c\d+)\/messages$/)?.[1];
    if (alwaysMissing || owner.get(conversation) !== validToken) {
      return Response.json({ error: { message: "대화를 찾을 수 없습니다." } }, { status: 404 });
    }
    answered += 1;
    return Response.json({ data: { messageId: `m${answered}`, answer: "안내 답변", sources: [] } });
  };

  assert.equal((await generateReply("첫 질문", "ko")).content, "안내 답변");
  assert.equal(created, 1);

  // 방문자 토큰 만료 → 새 세션이 발급되면 이전 대화(c1)는 서버에 없다.
  validToken = "expired";
  assert.equal((await generateReply("두 번째 질문", "ko")).content, "안내 답변");
  assert.equal(created, 2, "새 세션에서는 대화를 새로 연다");
  assert.equal(localStorage.getItem("festai-visitor-token"), "v2");

  alwaysMissing = true;
  const before = created;
  await assert.rejects(generateReply("세 번째 질문", "ko"), /대화를 찾을 수 없습니다/);
  assert.equal(created - before, 1, "복구는 한 번만 시도한다");
});

test("백엔드 설문 타입과 답변 유무를 명시적으로 처리한다", () => {
  assert.equal(surveyQuestionType("SINGLE_CHOICE"), "single_choice");
  assert.equal(surveyQuestionType("MULTIPLE_CHOICE"), "multiple_choice");
  assert.equal(hasSurveyAnswer([]), false);
  assert.equal(hasSurveyAnswer(["공연"]), true);
  assert.throws(() => surveyQuestionType("UNKNOWN"));
});

test("백엔드 민원 분류 결과를 주제별 집계·반복 이슈·개선 과제로 요약한다", () => {
  const row = (id, topic, urgent, status = "OPEN") => ({
    id, title: `${topic}-${id}`, description: "", priority: "NORMAL", status, updated_at: null,
    analysis: { topic, sentiment: urgent ? "NEGATIVE" : "NEUTRAL", urgent, humanReviewed: false, note: null },
  });
  const rows = [row("1", "CROWD", false), row("2", "CROWD", false), row("3", "SAFETY", true), row("4", "FACILITY", false, "CLOSED")];

  const breakdown = buildTopicBreakdown(rows);
  assert.deepEqual(breakdown.map((entry) => [entry.topic, entry.count]), [["CROWD", 2], ["SAFETY", 1], ["FACILITY", 1]]);

  // 2건 이상만 반복 이슈다 — 1건짜리를 반복이라 부르면 신호가 죽는다.
  assert.deepEqual(buildRecurringIssues(rows).map((issue) => issue.topic), ["CROWD"]);

  // 종료된 티켓은 개선 과제에서 빠지고, 긴급 건이 있는 주제가 높음이 된다.
  const tasks = buildImprovementTasks(rows);
  assert.equal(tasks.some((task) => task.title.startsWith("편의시설")), false);
  assert.equal(tasks.find((task) => task.title.startsWith("안전"))?.priority, "높음");
  assert.equal(tasks.find((task) => task.title.startsWith("혼잡"))?.priority, "중간");
});

test("운영 티켓은 배정부터 완료까지 순서대로 전이한다", () => {
  assert.equal(nextTicketStatus("OPEN"), "ASSIGNED");
  assert.equal(nextTicketStatus("ASSIGNED"), "IN_PROGRESS");
  assert.equal(nextTicketStatus("IN_PROGRESS"), "RESOLVED");
  assert.equal(nextTicketStatus("RESOLVED"), "CLOSED");
  assert.equal(nextTicketStatus("CLOSED"), undefined);
});

test("공지 발행 입력은 서버에 보내기 전에 걸러내고, 종료는 노출 중인 공지만 허용한다", () => {
  const base = { title: "우천 안내", audience: ["VISITOR"], startsAt: "2026-08-14T10:00", endsAt: "" };
  assert.equal(validatePublishInput(base), null);
  assert.match(validatePublishInput({ ...base, title: "  " }), /공지 내용/);
  assert.match(validatePublishInput({ ...base, audience: [] }), /노출 대상/);
  assert.match(validatePublishInput({ ...base, startsAt: "" }), /노출 시작/);
  assert.match(validatePublishInput({ ...base, endsAt: "2026-08-14T09:00" }), /노출 시작 이후/);
  assert.equal(validatePublishInput({ ...base, endsAt: "2026-08-14T11:00" }), null);

  assert.equal(canClose("ACTIVE"), true);
  assert.equal(canClose("SCHEDULED"), true);
  assert.equal(canClose("DRAFT"), false);
  assert.equal(canClose("CLOSED"), false);
  assert.equal(canClose("EXPIRED"), false);
});

test("콘텐츠 버전 상태에 맞는 다음 검수·게시 동작을 고른다", () => {
  assert.equal(contentAction("DRAFT", false), "SUBMIT");
  assert.equal(contentAction("IN_REVIEW", false), "REVIEW");
  assert.equal(contentAction("APPROVED", false), "PUBLISH");
  assert.equal(contentAction("APPROVED", true), "UNPUBLISH");
  assert.equal(contentAction("REJECTED", false), undefined);
  assert.equal(contentPreview({ summary: "축제 요약" }), "축제 요약");
});

test("검수자는 검수가 필요한 화면에 모두 접근할 수 있다", () => {
  // 백엔드가 REVIEWER에게 열어둔 화면들 — 하나라도 막히면 검수자가 일을 못 한다
  // businesses/{id}/review와 ai/operations/search도 검수자에게 열려 있다.
  for (const path of ["/admin/content", "/admin/ai-insights", "/admin/esg", "/admin/businesses", "/admin/documents", "/admin/surveys"]) {
    assert.equal(canAccessPath("REVIEWER", path), true, path);
  }
  // 감사 로그·계정 관리·리워드는 검수자 권한 밖이다.
  for (const path of ["/admin/audit-logs", "/admin/members", "/admin/rewards", "/admin/festival"]) {
    assert.equal(canAccessPath("REVIEWER", path), false, path);
  }
  assert.deepEqual(
    visibleNavItems("REVIEWER").map((item) => item.href),
    ["/admin", "/admin/content", "/admin/ai-insights", "/admin/surveys", "/admin/documents", "/admin/esg", "/admin/businesses"],
  );
  // 계정·권한 관리는 최고 관리자 전용이다.
  assert.equal(canAccessPath("SUPER_ADMIN", "/admin/members"), true);
  assert.equal(canAccessPath("FESTIVAL_MANAGER", "/admin/members"), false);
});

test("쓰기 결과 알림은 실패를 항상 알리고, 성공은 관리자 화면과 지정 문구에만 띄운다", () => {
  const call = (outcome, meta, pathname) => mutationToast(outcome, meta, pathname, "서버 오류");

  // 조용히 실패하면 운영자가 처리된 줄 안다 — 실패는 어디서든, meta가 없어도 알린다.
  assert.deepEqual(call("error", undefined, "/"), { message: "서버 오류", tone: "error" });
  assert.deepEqual(call("error", {}, "/admin/tickets"), { message: "서버 오류", tone: "error" });

  assert.deepEqual(call("success", { success: "공지를 발행했어요." }, "/admin/announcements"), {
    message: "공지를 발행했어요.",
    tone: "success",
  });
  // 관리자 화면은 문구를 안 줘도 성공을 알린다.
  assert.deepEqual(call("success", undefined, "/admin/festival"), { message: "처리했어요.", tone: "success" });
  // 방문객 화면은 쓰기가 곧 화면 변화라 알리지 않는다.
  assert.equal(call("success", undefined, "/chat"), null);
  // silent는 성공·실패 모두 막는다.
  assert.equal(call("success", { silent: true }, "/admin/documents"), null);
  assert.equal(call("error", { silent: true }, "/admin/documents"), null);
});

test("사이드바 그룹은 연속 배치되어 헤더가 한 번만 나온다", () => {
  // 사이드바는 "앞 항목과 group이 다르면 헤더" 규칙으로 그리므로, 같은 group이
  // 떨어져 있으면 헤더가 두 번 찍힌다. 역할별로 걸러낸 뒤에도 지켜져야 한다.
  for (const role of ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR", "REVIEWER"]) {
    const groups = visibleNavItems(role).map((item) => item.group);
    const headers = groups.filter((group, i) => group && group !== groups[i - 1]);
    assert.deepEqual(headers, [...new Set(headers)], role);
    assert.equal(groups[0], undefined, `${role}: 대시보드가 맨 위에 있어야 한다`);
  }
  const groupOf = (href) => ADMIN_NAV_ITEMS.find((item) => item.href === href)?.group;
  assert.equal(groupOf("/admin/rewards"), "ESG");
  assert.equal(groupOf("/admin/esg"), "ESG");
  assert.equal(groupOf("/admin/businesses"), "설정·관리");
});

test("사이드바는 운영 빈도와 업무 흐름 순으로 배치된다", () => {
  assert.deepEqual(ADMIN_NAV_ITEMS.map((item) => item.href), [
    "/admin",
    "/admin/field", "/admin/bookings", "/admin/tickets", "/admin/coupons", "/admin/plogging", "/admin/reusable-containers",
    "/admin/staff", "/admin/programs",
    "/admin/announcements", "/admin/content", "/admin/ai-insights", "/admin/surveys", "/admin/documents",
    "/admin/esg", "/admin/rewards",
    "/admin/festival", "/admin/map-locations", "/admin/businesses", "/admin/members", "/admin/privacy", "/admin/audit-logs",
  ]);
});

test("자동 번역은 항목별 필드를 한 번의 요청으로 묶고, 실패하면 원문을 유지한다", async () => {
  const spots = [
    { id: "st1", name: "통합 안내소", location: "정문 입구", collected: true },
    { id: "st2", name: "그린마켓", location: "마켓존", collected: false },
  ];
  let requests = 0;

  globalThis.fetch = async (_input, init = {}) => {
    requests += 1;
    const { entries } = JSON.parse(String(init.body));
    return Response.json({ entries: Object.fromEntries(Object.keys(entries).map((key) => [key, `EN:${entries[key]}`])) });
  };

  assert.deepEqual(await translateFields(spots, ["name", "location"], "ko"), spots, "한국어는 요청하지 않는다");
  assert.equal(requests, 0);

  const translated = await translateFields(spots, ["name", "location"], "en");
  assert.equal(requests, 1, "항목이 여러 개여도 요청은 한 번");
  assert.deepEqual(translated[0], { id: "st1", name: "EN:통합 안내소", location: "EN:정문 입구", collected: true });
  assert.equal(translated[1].collected, false, "번역 대상이 아닌 필드는 그대로 둔다");

  globalThis.fetch = async () => { throw new Error("network down"); };
  assert.deepEqual(await translateFields(spots, ["name"], "en"), spots, "실패하면 원문으로 fallback");
});

test("첫 발화 언어는 문자 종류로 판별하고 미지원 언어는 전환하지 않는다", () => {
  const all = ["ko", "en", "zh", "ja"];
  assert.equal(detectLocale("화장실 어디예요", all), "ko");
  assert.equal(detectLocale("where is the restroom", all), "en");
  assert.equal(detectLocale("トイレはどこですか", all), "ja");
  assert.equal(detectLocale("洗手间在哪里", all), "zh");
  // 일본어는 한자가 섞여 있어도 가나로 먼저 가른다.
  assert.equal(detectLocale("駅はどこですか", all), "ja");
  assert.equal(detectLocale("Где туалет", all), null, "지원 목록에 없는 문자는 판별 실패");
  assert.equal(detectLocale("洗手间在哪里", ["ko", "en"]), null, "축제가 지원하지 않는 언어로는 전환하지 않는다");
  assert.equal(detectLocale("", all), null);
});

test("역할이 없으면 관리자 화면에 접근할 수 없다", () => {
  assert.equal(canAccessPath(undefined, "/admin"), false);
  assert.equal(canAccessPath("MERCHANT", "/admin/audit-logs"), false);
});

// 기준 시각은 UTC로 준다 — Asia/Seoul은 UTC+9라 KST 12:00은 같은 날 03:00Z다.
const kst = (iso) => new Date(iso);

test("운영시간은 축제 기준 시각(Asia/Seoul)으로 열림·닫힘을 판정한다", () => {
  const hours = { daily: "09:00-20:00" };
  assert.deepEqual(operatingStatus(hours, kst("2026-09-12T03:00:00Z")), { open: true, hours: "09:00-20:00" });
  assert.equal(operatingStatus(hours, kst("2026-09-12T12:00:00Z")).open, false);
  // 여는 시각 정각은 열림, 닫는 시각 정각은 닫힘.
  assert.equal(operatingStatus(hours, kst("2026-09-12T00:00:00Z")).open, true);
  assert.equal(operatingStatus(hours, kst("2026-09-12T11:00:00Z")).open, false);
});

test("자정을 넘기는 야간 운영도 열림으로 판정한다", () => {
  const hours = { daily: "22:00-02:00" };
  assert.equal(operatingStatus(hours, kst("2026-09-12T16:00:00Z")).open, true);
  assert.equal(operatingStatus(hours, kst("2026-09-12T14:00:00Z")).open, true);
  assert.equal(operatingStatus(hours, kst("2026-09-12T03:00:00Z")).open, false);
});

test("판정할 수 없는 운영시간은 닫힘으로 단정하지 않고 문자열만 남긴다", () => {
  assert.deepEqual(operatingStatus({ daily: "상시 개방" }), { open: null, hours: "상시 개방" });
  assert.deepEqual(operatingStatus(null), { open: null, hours: null });
  assert.deepEqual(operatingStatus({}), { open: null, hours: null });
  assert.deepEqual(operatingStatus({ daily: "  " }), { open: null, hours: null });
});

test("festivalApi는 현재 축제 경로를 붙이고 json()은 본문을 직렬화한다", async () => {
  localStorage.setItem("festai-admin-access", "access");
  const requests = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push([url, init?.method, init?.body]);
    if (url.endsWith("/admin/festivals")) return Response.json({ data: [{ id: "festival-1", code: "EST34-2026" }] });
    return Response.json({ data: { ok: true } });
  };

  await festivalApi("/programs");
  await festivalApi("", json("PATCH", { name: "새 이름" }));

  const calls = requests.filter(([url]) => !url.endsWith("/admin/festivals"));
  assert.deepEqual(calls, [
    ["/api/backend/admin/festivals/festival-1/programs", undefined, undefined],
    ["/api/backend/admin/festivals/festival-1", "PATCH", JSON.stringify({ name: "새 이름" })],
  ]);
});

// --- 2차 감사에서 고친 것들 --------------------------------------------------

test("예약 조치 목록은 서버 전이 규칙과 같다", async () => {
  const { bookingActionsFor } = await importTypeScript("../src/shared/lib/booking-policy.ts");
  // 서버 BOOKING_TRANSITIONS: WAITING→CALLED/CANCELLED, CONFIRMED·CALLED→COMPLETED/NO_SHOW/CANCELLED.
  // 예전에는 현장 화면이 CONFIRMED에 호출을, WAITING에 이용 완료를 열어 둬서 누르면 400이었다.
  assert.deepEqual(bookingActionsFor("WAITING"), ["CALLED"]);
  assert.deepEqual(bookingActionsFor("CONFIRMED"), ["COMPLETED", "NO_SHOW"]);
  assert.deepEqual(bookingActionsFor("CALLED"), ["COMPLETED", "NO_SHOW"]);
  for (const terminal of ["COMPLETED", "CANCELLED", "NO_SHOW", "UNKNOWN"]) {
    assert.deepEqual(bookingActionsFor(terminal), [], terminal);
  }
});

test("프로그램 상태 선택지는 서버가 받는 값만 담는다", async () => {
  const { PROGRAM_STATUSES, PROGRAM_STATUS_LABEL } = await importTypeScript("../src/entities/program.ts", {
    ...entity,
    // 통합 목록이 참여업체·인력 조회를 함께 쓰는데, 상태 표 검증에는 필요 없어 스텁으로 끊는다.
    "@/features/business-admin": moduleUrl("export const fetchAdminBusinesses = async () => []; export const PARTICIPATION_LABEL = {};"),
    "@/features/staff": moduleUrl("export const fetchStaffAssignments = async () => [];"),
  });
  // 서버 ProgramStatus·DB CHECK 제약이 받는 값. ENDED는 없어서 고르면 400이었다.
  assert.deepEqual([...PROGRAM_STATUSES], ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]);
  for (const status of PROGRAM_STATUSES) assert.ok(PROGRAM_STATUS_LABEL[status], status);
});

test("설문 응답은 설문 단위로 나눠 보낸다", async () => {
  const { submitSurvey } = await importTypeScript("../src/entities/visitor.ts", entity);
  localStorage.setItem("festai-visitor-token", "vs_test");
  const posted = [];
  globalThis.fetch = async (input, init = {}) => {
    posted.push({ url: String(input), body: JSON.parse(String(init.body)) });
    return Response.json({ data: { id: "response" } });
  };

  // 설문이 두 개 열려 있으면 문항도 두 설문에서 온다 — 예전에는 첫 설문만 보였다.
  await submitSurvey(
    [
      { id: "q1", surveyId: "s1", question: "만족?", type: "rating", required: true },
      { id: "q2", surveyId: "s2", question: "의견?", type: "text", required: false },
    ],
    { q1: 5, q2: "좋았어요" },
  );

  assert.equal(posted.length, 2);
  assert.ok(posted[0].url.endsWith("/visitor/surveys/s1/responses"));
  assert.deepEqual(posted[0].body.answers, [{ questionId: "q1", value: 5 }]);
  assert.ok(posted[1].url.endsWith("/visitor/surveys/s2/responses"));
  assert.deepEqual(posted[1].body.answers, [{ questionId: "q2", value: "좋았어요" }]);
});

test("목록 조회는 커서를 끝까지 따라간다", async () => {
  localStorage.setItem("festai-admin-access", "access");
  const { festivalApiAll } = await import(apiUrl);
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/admin/festivals")) return Response.json({ data: [{ id: "f1", code: "EST34-2026" }] });
    requested.push(url);
    // 첫 페이지만 다음 커서를 준다.
    return url.includes("cursor=")
      ? Response.json({ data: [{ id: "b" }], page: { nextCursor: null, hasNext: false, limit: 100 } })
      : Response.json({ data: [{ id: "a" }], page: { nextCursor: "cur1", hasNext: true, limit: 100 } });
  };

  const rows = await festivalApiAll("/bookings");
  assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
  assert.equal(requested.length, 2);
  assert.ok(requested[1].includes("cursor=cur1"));
});

test("번역이 실패하면 원문을 돌려주되 degraded로 알린다", async () => {
  const client = await importTypeScript("../src/shared/lib/i18n/translate-client.ts");
  globalThis.fetch = async () => Response.json({ error: "boom" }, { status: 503 });
  const entries = { title: "축제 안내" };
  assert.deepEqual(await client.translateEntries(entries, "en"), entries);
  assert.equal(client.isTranslationDegraded(), true);

  globalThis.fetch = async () => Response.json({ entries: { title: "Festival guide" }, degraded: false });
  assert.deepEqual(await client.translateEntries(entries, "en"), { title: "Festival guide" });
  assert.equal(client.isTranslationDegraded(), false);
});

test("모바일 하단 탭은 볼 수 있는 화면만, 사이드바와 같은 권한으로 노출한다", () => {
  const hrefs = (role) => mobileNavItems(role).map((item) => item.href);

  // 현장 운영자가 폰으로 여는 화면이 전부 들어 있고, 순서가 유지된다.
  assert.deepEqual(hrefs("FIELD_OPERATOR"), [
    "/admin", "/admin/field", "/admin/bookings", "/admin/coupons", "/admin/tickets",
  ]);
  // 권한 없는 항목은 탭에도 없어야 한다 — 들어가 봐야 403만 본다.
  for (const role of ["FIELD_OPERATOR", "REVIEWER", "MERCHANT", "SUPER_ADMIN"]) {
    for (const href of hrefs(role)) assert.ok(canAccessPath(role, href), `${role}이 ${href}에 못 들어갑니다.`);
  }
  // 현장 화면이 거의 없는 역할·비로그인은 탭바 자체를 띄우지 않는다.
  assert.deepEqual(hrefs("REVIEWER"), []);
  assert.deepEqual(hrefs(undefined), []);
});

test("사이드바 항목은 모두 아이콘이 등록돼 있다", async () => {
  // 아이콘을 빠뜨리면 관리자 화면 전체가 렌더 중 죽는다(undefined 컴포넌트).
  // 렌더 시에는 기본 아이콘으로 받아내지만, 등록 자체를 잊지 않도록 여기서 잡는다.
  const source = await readFile(new URL("../src/widgets/admin-sidebar/admin-sidebar.tsx", import.meta.url), "utf8");
  const registered = new Set([...source.matchAll(/"(\/admin[^"]*)":/g)].map((match) => match[1]));
  for (const item of ADMIN_NAV_ITEMS) {
    assert.ok(registered.has(item.href), `${item.href} 아이콘이 NAV_ICONS에 없습니다.`);
  }
});

test("일시 입력은 브라우저 타임존과 무관하게 축제 기준(Asia/Seoul) 시각으로 오간다", () => {
  // 2026-09-12T01:00Z = KST 10:00. UTC 노트북에서 열어도 입력칸에는 10:00이 떠야 한다.
  assert.equal(datetimeLocal("2026-09-12T01:00:00Z"), "2026-09-12T10:00");
  // 입력한 벽시계 시각은 KST로 읽어 서버에 보낸다(왕복해도 그대로다).
  assert.equal(toIso("2026-09-12T10:00"), "2026-09-12T01:00:00.000Z");
  assert.equal(datetimeLocal(toIso("2026-09-12T10:00")), "2026-09-12T10:00");
  // 타임존이 붙은 값은 건드리지 않는다.
  assert.equal(toIso("2026-09-12T01:00:00Z"), "2026-09-12T01:00:00.000Z");
});

test("목록 토글은 없으면 넣고 있으면 빼며, 원본을 건드리지 않는다", () => {
  const first = toggleValue([], "VISITOR");
  assert.deepEqual(first, ["VISITOR"]);
  assert.deepEqual(toggleValue(first, "STAFF"), ["VISITOR", "STAFF"]);
  assert.deepEqual(toggleValue(first, "VISITOR"), []);
  assert.deepEqual(first, ["VISITOR"]);
});

test("예약 셀프 취소는 시작 30분 전에 닫힌다(서버 규칙과 같은 표)", () => {
  const startsAt = "2026-09-12T10:00:00Z";
  const at = (iso) => new Date(iso).getTime();
  assert.equal(isCancelDeadlinePassed(startsAt, at("2026-09-12T09:29:00Z")), false);
  assert.equal(isCancelDeadlinePassed(startsAt, at("2026-09-12T09:30:00Z")), true);
  assert.equal(isCancelDeadlinePassed(startsAt, at("2026-09-12T10:30:00Z")), true);
  // 시각을 읽지 못하면 버튼을 막지 않는다 — 서버가 최종 판정한다.
  assert.equal(isCancelDeadlinePassed("nope", at("2026-09-12T09:30:00Z")), false);
});

test("멱등키는 crypto.randomUUID가 없는 http 접속에서도 만들어진다", async () => {
  const original = crypto.randomUUID;
  try {
    // 보안 컨텍스트가 아니면 randomUUID 자체가 없다(현장 폰이 http://<LAN IP>로 열 때).
    Reflect.deleteProperty(crypto, "randomUUID");
    const { idempotencyKey } = await import(apiUrl);
    const key = idempotencyKey();
    assert.equal(typeof key, "string");
    assert.ok(key.length > 8 && key !== idempotencyKey());
  } finally {
    Object.defineProperty(crypto, "randomUUID", { configurable: true, writable: true, value: original });
  }
});


test("연령대 판정은 표본이 모자라거나 흔들리면 제안하지 않는다", () => {
  // 한 프레임 추정은 몇 살씩 튀므로 중앙값으로 본다 — 68이 하나 섞여도 제안하지 않는다.
  assert.equal(isSeniorAge([34, 41, 68]), false);
  assert.equal(isSeniorAge([64, 67, 71]), true);
  // 기준(62) 바로 아래는 제안하지 않는다.
  assert.equal(isSeniorAge([58, 61, 61]), false);
  // 표본이 모자라면 값이 아무리 높아도 판정하지 않는다.
  assert.equal(isSeniorAge([80, 82]), false);
  assert.equal(isSeniorAge([]), false);
});

test("SELF가 아닌 리워드 행동에만 현장 인증 값이 붙는다", () => {
  const input = { actionType: "STAMP_PHOTO_ZONE", name: "포토존", location: "물빛광장", points: 10, perUserLimit: 1 };
  // 인증 값이 없으면 백엔드가 400으로 거절하고, 있으면 인쇄한 QR과 값이 같아야 적립된다.
  assert.deepEqual(rewardActionRule({ ...input, verificationType: "QR" }).verificationKeys, ["stamp:stamp-photo-zone"]);
  assert.equal(rewardActionRule({ ...input, verificationType: "SELF" }).verificationKeys, undefined);
});

const activityHistoryUrl = await transpile("../src/features/activity-history.ts", {
  "@/shared/lib/api": apiUrl,
  "@tanstack/react-query": moduleUrl("export const useQuery = () => ({});"),
});
const { fetchActivityHistory } = await import(activityHistoryUrl);
const { createPloggingSubmission } = await importTypeScript("../src/features/plogging.ts", {
  "@/shared/lib/api": apiUrl,
  "@/features/activity-history": activityHistoryUrl,
});

test("방문객 활동은 인증된 서버 목록의 커서를 끝까지 따라간다", async () => {
  localStorage.setItem("festai-visitor-token", "vs_activity");
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer vs_activity");
    const second = url.includes("cursor=next%2Bpage");
    return Response.json({
      data: [{ id: second ? "r2" : "r1" }],
      page: { hasNext: !second, nextCursor: second ? null : "next+page", limit: 200 },
    });
  };
  assert.deepEqual(await fetchActivityHistory("rentals", false), [{ id: "r1" }, { id: "r2" }]);
  assert.equal(requests.length, 2);
});

test("플로깅 인증은 포인트·운영자 값을 만들지 않고 서버에 멱등키와 함께 보낸다", async () => {
  // 다른 테스트에서 저장한 축제 ID 캐시는 로그아웃으로 비운다.
  globalThis.fetch = async () => new Response(null, { status: 204 });
  await logoutAdmin();
  localStorage.setItem("festai-admin-access", "operator-access");
  let captured;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/admin/festivals")) {
      return Response.json({ data: [{ id: "festival-activity", code: "EST34-2026" }] });
    }
    captured = { url: String(input), body: JSON.parse(init.body), headers: new Headers(init.headers) };
    return Response.json({ data: { id: "p1", points: 60 } });
  };
  const result = await createPloggingSubmission({ visitorCode: "VIS-SERVER-CODE", bagCount: 2, location: "회수존" });
  assert.equal(result.points, 60);
  assert.match(captured.url, /festival-activity\/activities\/plogging$/);
  assert.deepEqual(captured.body, { visitorCode: "VIS-SERVER-CODE", bagCount: 2, location: "회수존" });
  assert.ok(captured.headers.get("Idempotency-Key"));
});

test("공개 축제 원본은 소비자의 갱신 주기가 달라도 공유하고 무효화하면 다시 받는다", async () => {
  const client = new QueryClient();
  globalThis.festivalTestClient = client;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ data: { id: "shared-festival" } }); };
  try {
    const loaders = [30_000, 60_000, Infinity].map((interval) => usePublicFestivalLoader(interval));
    const results = await Promise.all(loaders.map((load) => load()));
    assert.equal(calls, 1);
    assert.deepEqual(results.map((row) => row.id), Array(3).fill("shared-festival"));
    await client.invalidateQueries({ queryKey: PUBLIC_FESTIVAL_KEY });
    await loaders[0]();
    assert.equal(calls, 2);
  } finally {
    client.clear();
    delete globalThis.festivalTestClient;
  }
});

test("ESG 카드·정의·실적은 같은 원본 요청을 공유한다", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  await logoutAdmin();
  localStorage.setItem("festai-admin-access", "access");
  const counts = { metrics: 0, measurements: 0 };
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/admin/festivals")) return Response.json({ data: [{ id: "esg-shared", code: "EST34-2026" }] });
    if (url.endsWith("/esg/metrics")) {
      counts.metrics += 1;
      return Response.json({ data: [{ id: "metric", name: "재사용", category: "E", versions: [{ id: "v2", unit: "%", target: 100 }] }] });
    }
    counts.measurements += 1;
    return Response.json({ data: [], page: { hasNext: false, nextCursor: null, limit: 100 } });
  };
  try {
    const [cards] = await Promise.all([
      fetchEsgMetrics(client),
      client.fetchQuery({ queryKey: ["esg-metric-definitions"], queryFn: fetchMetricDefinitions }),
      client.fetchQuery({ queryKey: ["esg-measurements"], queryFn: () => fetchMeasurements() }),
    ]);
    assert.deepEqual(counts, { metrics: 1, measurements: 1 });
    assert.equal(cards[0].value, 0);
  } finally {
    client.clear();
  }
});

test("ESG 집계는 이전 지표 버전의 승인 실적을 포함하고 대체된 실적을 제외한다", () => {
  const [metric] = buildEsgMetrics([
    { id: "m", name: "재사용", category: "E", versions: [{ id: "new", unit: "%", target: 100 }, { id: "old" }] },
  ], [
    { metricVersionId: "new", value: "20", status: "APPROVED", sourceType: "MANUAL", updatedAt: "2026-10-21T00:00:00Z" },
    { metricVersionId: "old", value: "10", status: "APPROVED" },
    { metricVersionId: "old", value: "999", status: "SUPERSEDED" },
  ]);
  assert.equal(metric.value, 30);
  assert.equal(metric.approvedAt, "2026-10-21");
  assert.equal(metric.unit, "%");
});

test("페이지 수집은 상한·반복 커서·요청 실패의 기존 정책을 보존한다", async () => {
  const { collectPages } = await import(apiUrl);
  let calls = 0;
  const repeat = async () => { calls += 1; return { data: [calls], page: { hasNext: true, nextCursor: "same", limit: 1 } }; };
  assert.equal((await collectPages(repeat, { maxPages: 10 })).length, 10);
  calls = 0;
  await assert.rejects(() => collectPages(repeat, { repeatedCursorError: "활동 목록의 다음 페이지를 조회할 수 없습니다." }), /다음 페이지/);
  assert.equal(calls, 2);
  await assert.rejects(() => collectPages(async () => { throw new Error("offline"); }), /offline/);
});
