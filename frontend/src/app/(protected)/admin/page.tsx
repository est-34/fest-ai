"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Users, Store, Ticket as TicketIcon, ArrowRight, Leaf } from "lucide-react";
import { fetchOpsSnapshot, type OpsFilters } from "@/widgets/dashboard-stats/data";
import { CROWD_LABEL, CROWD_TONE } from "@/features/crowd/api/crowd";
import { fetchAreas } from "@/entities/area";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { fetchTickets, PRIORITY_TONE } from "@/entities/ticket";
import { StatusPill } from "@/shared/ui/status-pill";
import { fetchOperationResources } from "@/widgets/operation-resources/data";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import { FestivalBriefCard } from "@/features/festival-brief/ui/festival-brief-card";
import { LANGUAGE_BY_LOCALE, type Locale } from "@/shared/lib/i18n";
import { useForm } from "@/shared/lib/use-form";
import { seoulDateTime } from "@/shared/lib/utils";

const EMPTY_FILTERS: OpsFilters = { areaId: "", timeFrom: "", timeTo: "" };

export default function AdminDashboardPage() {
  // OPS-03: 축제·구역·시간 필터. 서버가 같은 필터를 지표마다 적용하고 어떤 값을 썼는지 되돌려 준다.
  const { form: filters, field: filterField, set: setFilter, reset: resetFilters } = useForm<OpsFilters>(EMPTY_FILTERS);
  const areasQuery = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  const opsQuery = useQuery({
    queryKey: ["ops-snapshot", filters] as const,
    queryFn: () => fetchOpsSnapshot(filters),
  });
  const ops = opsQuery.data;
  const filtered = Boolean(filters.areaId || filters.timeFrom || filters.timeTo);
  const ticketsQuery = useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });
  const resourcesQuery = useQuery({ queryKey: ["operation-resources"], queryFn: fetchOperationResources });
  const { data: tickets } = ticketsQuery;
  const { data: resources } = resourcesQuery;

  const openTickets = (tickets ?? []).filter((t) => t.status !== "완료").slice(0, 4);
  const issueResources = (resources ?? []).filter((r) => r.status === "이슈");

  return (
    <div className="space-y-6">
      <FestivalBriefCard />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 space-y-1">
            <Label>구역</Label>
            <SelectField
              value={filters.areaId || "all"}
              onValueChange={(value) => setFilter("areaId")(value === "all" ? "" : value)}
              options={[{ value: "all", label: "전체 구역" }, ...(areasQuery.data ?? []).map((area) => ({ value: area.id, label: area.name }))]}
              aria-label="구역"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ops-from">시작</Label>
            <Input
              id="ops-from"
              type="datetime-local"
              {...filterField("timeFrom")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ops-to">종료</Label>
            <Input
              id="ops-to"
              type="datetime-local"
              {...filterField("timeTo")}
            />
          </div>
          {filtered && (
            <Button size="sm" variant="outline" onClick={resetFilters}>필터 초기화</Button>
          )}
        </div>
        {/* 숫자만 보여주면 어느 시점 어떤 원천인지 알 수 없어 현장 판단에 쓸 수 없다. */}
        <p className="mt-3 text-[0.6875rem] text-muted-foreground">
          출처 {ops?.sources.join(", ") ?? "-"} · 혼잡 기준 시각{" "}
          {ops?.updatedAt ? seoulDateTime(ops.updatedAt) : "기록 없음"}
          {filters.areaId && " · 방문 세션·포인트는 구역과 연결되지 않아 전체 값으로 표시돼요."}
        </p>
      </section>

      <QueryState
        query={opsQuery}
        // 자리표시자는 실제 카드와 같은 개수·같은 열 수여야 도착한 뒤 화면이 튀지 않는다.
        skeleton={<SkeletonList count={6} className="h-24 rounded-2xl" wrapperClassName="grid grid-cols-2 gap-3 space-y-0 lg:grid-cols-3" />}
      >
        {(ops) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="방문 세션" value={ops.visitors.toLocaleString()} helper="백엔드 누적 방문 세션" icon={Users} tone="primary" />
            <StatCard label="진행 중 예약" value={ops.activeBookings.toLocaleString()} helper="확정·대기·호출 상태" icon={CalendarCheck} href="/admin/programs" />
            <StatCard label="처리 필요 티켓" value={ops.openTickets.toLocaleString()} helper="미해결 민원·사고" icon={TicketIcon} href="/admin/tickets" />
            <StatCard label="승인 참여업체" value={ops.approvedBusinesses.toLocaleString()} helper="축제 참여 승인 완료" icon={Store} href="/admin/businesses" />
            <StatCard label="쿠폰 발급" value={ops.couponIssues.toLocaleString()} helper="참여업체 쿠폰 누적 발급" icon={TicketIcon} href="/admin/businesses" />
            <StatCard label="ESG 포인트 발급" value={`${ops.pointsIssued.toLocaleString()}P`} helper="리워드 캠페인 누적 지급" icon={Leaf} tone="esg" href="/admin/rewards" />
          </div>
        )}
      </QueryState>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">처리 필요 민원·공지·사고</h2>
            <Link href="/admin/tickets" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
              전체보기 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            <QueryState
              query={ticketsQuery}
              empty="처리 대기 중인 티켓이 없어요."
              emptyWhen={openTickets.length === 0}
              skeleton={<Skeleton className="h-16 w-full rounded-xl" />}
            >
              {() => (
                openTickets.map((t) => (
                  <Link
                    key={t.id}
                    href="/admin/tickets"
                    className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.type} · {t.assignee} · {t.createdAt}</p>
                    </div>
                    <StatusPill tone={PRIORITY_TONE[t.priority]} className="shrink-0">
                      {t.priority}
                    </StatusPill>
                  </Link>
                ))
              )}
            </QueryState>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">운영 자원 이슈</h2>
            <Link href="/admin/programs" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
              통합 운영관리 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            <QueryState
              query={resourcesQuery}
              empty="현재 이슈가 없어요."
              emptyWhen={issueResources.length === 0}
              skeleton={<Skeleton className="h-16 w-full rounded-xl" />}
            >
              {() => (
                issueResources.map((r) => (
                  <Link
                    key={r.id}
                    href="/admin/programs"
                    className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.category} · {r.location}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-[0.625rem]">{r.note}</Badge>
                  </Link>
                ))
              )}
            </QueryState>
          </div>
        </div>
      </div>

      {/* OPS-03 혼잡·대기: 현장 입력(OPS-07)이 원천이라 유효시간이 지난 값은 오래된 값으로 표시한다. */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">구역별 혼잡·대기</h2>
          <Link href="/admin/field" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
            현장 입력 <ArrowRight className="size-3" />
          </Link>
        </div>
        {!ops?.crowd.length ? (
          <p className="text-xs text-muted-foreground">선택한 조건에 등록된 혼잡 정보가 없어요.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ops.crowd.map((zone) => (
              <div key={zone.areaId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{zone.name}</p>
                  <StatusPill tone={zone.stale ? "muted" : CROWD_TONE[zone.crowdLevel]}>
                    {CROWD_LABEL[zone.crowdLevel]}
                  </StatusPill>
                </div>
                <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                  {zone.peopleCount !== null && `${zone.peopleCount.toLocaleString()}명 · `}
                  {zone.estimatedWaitMin !== null ? `예상 대기 ${zone.estimatedWaitMin}분` : "대기 정보 없음"}
                </p>
                <p className="text-[0.6875rem] text-muted-foreground">
                  {seoulDateTime(zone.capturedAt)} 기준{zone.stale && " · 오래된 값"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI-05 언어별 이용 로그: 방문 세션 언어와 첫 발화 자동 전환 건수 */}
      {ops && ops.languages.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">언어별 이용</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {ops.languages.map((row) => (
              <div key={row.language} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold text-foreground">{LANGUAGE_BY_LOCALE[row.language as Locale] ?? row.language}</p>
                <p className="text-lg font-bold text-primary">{row.sessions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">키오스크 {row.kioskSessions} · 자동 전환 {row.autoSwitched}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
