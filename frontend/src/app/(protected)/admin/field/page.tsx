"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BellRing, CheckCircle2, UserX } from "lucide-react";
import {
  CROWD_LABEL,
  CROWD_LEVELS,
  CROWD_TONE,
  createCrowdSnapshot,
  fetchCrowdSnapshots,
  type CrowdLevel,
  type NewCrowdSnapshot,
} from "@/features/crowd/api/crowd";
import { fetchAdminBookings, updateBookingStatus } from "@/entities/booking";
import { BOOKING_STATUS_LABEL, bookingActionsFor, type BookingAction } from "@/shared/lib/booking-policy";
import { fetchAreas } from "@/entities/area";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { StatusPill } from "@/shared/ui/status-pill";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { seoulDateTime, seoulTime } from "@/shared/lib/utils";

const DEFAULT_FORM: NewCrowdSnapshot = { areaId: "", crowdLevel: "MODERATE", peopleCount: null, estimatedWaitMin: null, validMinutes: 30 };

// 라벨과 아이콘만 화면이 정하고, 어떤 상태에서 어떤 조치가 가능한지는
// shared/lib/booking-policy가 서버 규칙과 같은 표로 들고 있다.
const BOOKING_ACTION_META: Record<BookingAction, { label: string; icon: typeof BellRing }> = {
  CALLED: { label: "호출", icon: BellRing },
  COMPLETED: { label: "이용 완료", icon: CheckCircle2 },
  NO_SHOW: { label: "미방문", icon: UserX },
};

const BOOKING_FILTERS = ["대기·호출", "완료", "전체"] as const;
type BookingFilter = (typeof BOOKING_FILTERS)[number];

function matchesBooking(status: string, filter: BookingFilter) {
  if (filter === "전체") return true;
  if (filter === "완료") return ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status);
  return ["CONFIRMED", "WAITING", "CALLED"].includes(status);
}

export default function FieldOperationsPage() {
  const { form, set, setForm } = useForm<NewCrowdSnapshot>(DEFAULT_FORM);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("대기·호출");

  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  const snapshots = useQuery({ queryKey: ["crowd-snapshots"], queryFn: fetchCrowdSnapshots });
  const bookings = useQuery({ queryKey: ["admin-bookings"], queryFn: () => fetchAdminBookings() });

  const submitSnapshot = useWrite(createCrowdSnapshot, {
    success: "혼잡도를 기록했어요.",
    invalidates: ["crowd-snapshots", "public-crowd", "festival-ai-brief"],
    // 같은 구역을 연달아 기록하는 경우가 많아 구역 선택만 남긴다.
    onSuccess: () => setForm((previous) => ({ ...DEFAULT_FORM, areaId: previous.areaId })),
  });
  const changeBooking = useWrite(updateBookingStatus, {
    success: "예약 상태를 변경했어요.", invalidates: ["admin-bookings"],
  });

  const visibleBookings = (bookings.data ?? []).filter((row) => matchesBooking(row.status, bookingFilter));

  // 구역별 최신 스냅샷만 현황으로 쓴다 — 목록은 시간 역순이라 첫 등장이 최신이다.
  const latestByArea = new Map<string, NonNullable<typeof snapshots.data>[number]>();
  (snapshots.data ?? []).forEach((row) => {
    if (!latestByArea.has(row.areaId)) latestByArea.set(row.areaId, row);
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        구역별 혼잡도를 직접 등록하고, 대기표를 호출·완료 처리해요. 등록한 혼잡도는 방문객 앱과 운영 위험 브리핑에 바로 반영돼요.
      </p>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Activity className="size-4 text-primary" /> 혼잡도 등록</h2>
        <Form className="mt-3 grid gap-3 sm:grid-cols-6" onSubmit={() => submitSnapshot.mutate(form)}>
          <div className="space-y-1 sm:col-span-2">
            <Label>구역</Label>
            <SelectField
              value={form.areaId}
              onValueChange={set("areaId")}
              options={(areas.data ?? []).map((area) => ({ value: area.id, label: area.name }))}
              placeholder="구역 선택"
              aria-label="구역"
            />
          </div>
          <div className="space-y-1">
            <Label>혼잡 수준</Label>
            <SelectField
              value={form.crowdLevel}
              onValueChange={(value) => set("crowdLevel")(value as CrowdLevel)}
              options={CROWD_LEVELS.map((level) => ({ value: level, label: CROWD_LABEL[level] }))}
              aria-label="혼잡 수준"
            />
          </div>
          {/* 인원 수는 타입에만 있고 입력란이 없어서 늘 비어 있었다 — 혼잡도 근거 수치다. */}
          <div className="space-y-1">
            <Label htmlFor="people">현재 인원(명)</Label>
            <Input id="people" type="number" min={0} value={form.peopleCount ?? ""} onChange={(event) => set("peopleCount")(event.target.value === "" ? null : Number(event.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wait">예상 대기(분)</Label>
            <Input id="wait" type="number" min={0} value={form.estimatedWaitMin ?? ""} onChange={(event) => set("estimatedWaitMin")(event.target.value === "" ? null : Number(event.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="valid">유효시간(분)</Label>
            <Input id="valid" type="number" min={5} value={form.validMinutes} onChange={(event) => set("validMinutes")(Number(event.target.value))} required />
          </div>
          <div className="sm:col-span-6 flex items-center justify-end gap-3">
            <ErrorText error={submitSnapshot.error} className="mr-auto" />
            <SubmitButton mutation={submitSnapshot} pending="등록 중..." disabled={!form.areaId}>혼잡도 등록</SubmitButton>
          </div>
        </Form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-bold text-foreground">구역별 최신 혼잡도</h2>
        <QueryState query={snapshots} empty="등록된 혼잡도가 없어요." emptyWhen={latestByArea.size === 0}>
          {() => (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...latestByArea.values()].map((row) => (
                <div key={row.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{row.areaName}</p>
                    <StatusPill tone={row.stale ? "muted" : CROWD_TONE[row.crowdLevel]} className="shrink-0">
                      {CROWD_LABEL[row.crowdLevel]}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                    {row.estimatedWaitMin !== null ? `예상 대기 ${row.estimatedWaitMin}분 · ` : ""}
                    {seoulTime(row.capturedAt)} 기준
                    {row.stale && " · 오래된 값"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">예약·대기표 현황</h2>
          <Tabs value={bookingFilter} onValueChange={(value) => setBookingFilter(value as BookingFilter)}>
            <TabsList>
              {BOOKING_FILTERS.map((value) => (
                <TabsTrigger key={value} value={value} className="gap-1.5">
                  {value}
                  <span className="text-[0.625rem] text-muted-foreground">
                    {(bookings.data ?? []).filter((row) => matchesBooking(row.status, value)).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <QueryState query={bookings} empty="표시할 예약이 없어요." emptyWhen={visibleBookings.length === 0}>
          {() => (
            <div className="space-y-2">
              {visibleBookings.map((booking) => (
                <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {booking.queueNumber ? `${booking.queueNumber}번 · ` : ""}{booking.programTitle}
                    </p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {seoulDateTime(booking.startsAt)} · {booking.partySize}명
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[0.625rem]">{BOOKING_STATUS_LABEL[booking.status] ?? booking.status}</Badge>
                    {bookingActionsFor(booking.status).map((status) => {
                      const { label, icon: Icon } = BOOKING_ACTION_META[status];
                      return (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          disabled={isPendingFor(changeBooking, booking.id)}
                          onClick={() => changeBooking.mutate({ bookingId: booking.id, status })}
                        >
                          <Icon className="size-3.5" /> {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
        <ErrorText error={changeBooking.error} className="mt-3 text-sm" />
      </section>
    </div>
  );
}
