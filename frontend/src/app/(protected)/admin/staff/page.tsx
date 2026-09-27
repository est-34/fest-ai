"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, UserCog } from "lucide-react";
import {
  acknowledgeAssignment,
  createStaffAssignment,
  fetchMemberships,
  fetchStaffAssignments,
  type NewStaffAssignment,
} from "@/features/staff";
import { fetchAreas } from "@/entities/area";
import { ADMIN_ROLE_LABEL } from "@/shared/lib/permissions";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { datetimeLocal, seoulDateTime, seoulTime, toIso } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";

function defaultForm(): NewStaffAssignment {
  const start = new Date();
  return {
    membershipId: "", areaId: "", dutyRole: "", task: "",
    startsAt: datetimeLocal(start), endsAt: datetimeLocal(new Date(start.getTime() + 4 * 60 * 60_000)),
  };
}

const ALL_AREAS = "__ALL__";

export default function StaffPage() {
  const { form, set, field, reset } = useForm<NewStaffAssignment>(defaultForm);
  const [areaFilter, setAreaFilter] = useState(ALL_AREAS);

  const assignments = useQuery({ queryKey: ["staff-assignments"], queryFn: fetchStaffAssignments });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  // 최고 관리자만 멤버십을 조회할 수 있다 — 권한이 없으면 배치 폼 없이 목록만 본다.
  const memberships = useQuery({ queryKey: ["memberships"], queryFn: fetchMemberships, retry: false });

  const invalidates = ["staff-assignments", "festival-ai-brief"];
  const assign = useWrite(createStaffAssignment, { success: "인력을 배치했어요.", invalidates, onSuccess: reset });
  const acknowledge = useWrite(acknowledgeAssignment, { success: "배정을 확인 처리했어요.", invalidates });

  const visible = (assignments.data ?? []).filter((row) => areaFilter === ALL_AREAS || row.areaId === areaFilter);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        구역별 현장 인력을 배치해요. 같은 인력의 근무 시간이 겹치면 서버가 배치를 거절하고, 배치되지 않은 구역은 운영 위험 브리핑에 인력 공백으로 잡힙니다.
      </p>

      {memberships.isError ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          인력 목록을 조회할 권한이 없어 배치 등록은 최고 관리자만 사용할 수 있어요.
        </p>
      ) : (
        <Form
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3"
          onSubmit={() =>
            assign.mutate({ ...form, task: form.task || undefined, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt) })
          }
        >
          <div className="space-y-1">
            <Label>인력</Label>
            <SelectField
              value={form.membershipId}
              onValueChange={set("membershipId")}
              options={(memberships.data ?? []).filter((member) => member.status === "ACTIVE").map((member) => ({
                value: member.id,
                label: `${member.name} · ${ADMIN_ROLE_LABEL[member.role] ?? member.role}`,
              }))}
              placeholder="인력 선택"
              aria-label="인력"
            />
          </div>
          <div className="space-y-1">
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
            <Label htmlFor="duty">담당 업무</Label>
            <Input id="duty" {...field("dutyRole")} required placeholder="예: 안전 관리" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="starts">시작</Label>
            <Input id="starts" type="datetime-local" {...field("startsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ends">종료</Label>
            <Input id="ends" type="datetime-local" {...field("endsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task">세부 지시(선택)</Label>
            <Input id="task" {...field("task")} />
          </div>
          <div className="sm:col-span-3 flex items-center justify-end gap-3">
            <ErrorText error={assign.error} className="mr-auto" />
            <SubmitButton mutation={assign} pending="배치 중..." disabled={!form.membershipId || !form.areaId}>
              인력 배치
            </SubmitButton>
          </div>
        </Form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="assignment-filter" className="text-xs text-muted-foreground">구역</Label>
        <SelectField
          value={areaFilter}
          onValueChange={setAreaFilter}
          options={[{ value: ALL_AREAS, label: "전체 구역" }, ...(areas.data ?? []).map((area) => ({ value: area.id, label: area.name }))]}
          size="sm"
          className="w-44"
          aria-label="구역"
        />
        <span className="text-xs text-muted-foreground">{visible.length}건</span>
      </div>

      <QueryState
        query={assignments}
        empty="표시할 배치가 없어요."
        emptyWhen={visible.length === 0}
        skeleton={<Skeleton className="h-32 w-full rounded-2xl" />}
      >
        {() => (
          <div className="space-y-2">
            {visible.map((assignment) => (
              <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <UserCog className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{assignment.staffName}</p>
                    <Badge variant="outline" className="text-[0.625rem]">{ADMIN_ROLE_LABEL[assignment.role] ?? assignment.role}</Badge>
                    <span className="text-xs text-muted-foreground">{assignment.dutyRole}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                    <Clock className="size-3" />
                    {seoulDateTime(assignment.startsAt)} ~ {seoulTime(assignment.endsAt)}
                    {assignment.task && ` · ${assignment.task}`}
                  </p>
                </div>
                {assignment.acknowledgedAt ? (
                  <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle2 className="size-3" /> 확인 완료
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={isPendingFor(acknowledge, assignment.id)} onClick={() => acknowledge.mutate(assignment.id)}>
                    배정 확인
                  </Button>
                )}
              </div>
            ))}
            <ErrorText error={acknowledge.error} className="text-sm" />
          </div>
        )}
      </QueryState>
    </div>
  );
}
