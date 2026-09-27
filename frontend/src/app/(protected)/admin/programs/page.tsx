"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, FileCheck2, Plus, Trash2 } from "lucide-react";
import {
  createProgram,
  createProgramSession,
  deleteProgram,
  deleteProgramSession,
  fetchProgramSessions,
  fetchPrograms,
  submitProgramContent,
  updateProgram,
  PROGRAM_STATUSES,
  PROGRAM_STATUS_LABEL,
  type NewProgram,
  type NewProgramSession,
  type Program,
} from "@/entities/program";
import { fetchOperationResources, type OperationCategory } from "@/widgets/operation-resources/data";
import { fetchAreas } from "@/entities/area";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { Textarea } from "@/shared/ui/textarea";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { StatusPill } from "@/shared/ui/status-pill";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { datetimeLocal, seoulShort, toIso } from "@/shared/lib/utils";

const CATEGORIES: (OperationCategory | "전체")[] = ["전체", "프로그램", "참여업체", "부스", "인력", "자원봉사자"];

// 방문객 fetchSchedule()이 이 코드로 한글 카테고리를 찾는다 — 값이 어긋나면 "기타"로 떨어진다.
const PROGRAM_CATEGORIES = [
  { value: "performance", label: "공연" },
  { value: "experience", label: "체험" },
  { value: "exhibition", label: "전시" },
  { value: "food", label: "푸드" },
  { value: "event", label: "행사" },
];

const STATUS_TONE = { 준비중: "neutral", 운영중: "success", 완료: "accent", 이슈: "danger" } as const;

const STATUS_OPTIONS = PROGRAM_STATUSES.map((status) => ({ value: status, label: PROGRAM_STATUS_LABEL[status] }));

const EMPTY_PROGRAM: NewProgram = { slug: "", title: "", summary: "", category: "performance", status: "DRAFT" };

function SessionPanel({ program }: { program: Program }) {
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  const sessions = useQuery({ queryKey: ["program-sessions", program.id], queryFn: () => fetchProgramSessions(program.id) });
  const { form, set, field } = useForm<NewProgramSession>(() => {
    const start = new Date();
    return { areaId: "", startsAt: datetimeLocal(start), endsAt: datetimeLocal(new Date(start.getTime() + 60 * 60_000)), capacity: 30, status: "OPEN" };
  });

  const invalidates = [["program-sessions", program.id], "operation-resources"] as const;
  const create = useWrite(createProgramSession, { success: "회차를 추가했어요.", invalidates });
  const remove = useWrite(deleteProgramSession, { success: "회차를 삭제했어요.", invalidates });
  const areaName = (id: string) => areas.data?.find((area) => area.id === id)?.name ?? "구역";

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground"><CalendarPlus className="size-3.5" /> 회차 관리</p>
      <QueryState
        query={sessions}
        className="mt-2"
        empty="등록된 회차가 없습니다."
        skeleton={<Skeleton className="mt-2 h-10 w-full rounded-lg" />}
      >
        {(rows) => (
          <ul className="mt-2 space-y-1">
            {rows.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                <span className="text-foreground">
                  {seoulShort(session.startsAt)}
                  {" · "}{areaName(session.areaId)}{session.capacity !== null && ` · 정원 ${session.capacity}명`}
                </span>
                <ConfirmButton
                  variant="ghost"
                  size="icon-xs"
                  aria-label="회차 삭제"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isPendingFor(remove, session.id)}
                  title="회차를 삭제할까요?"
                  description={`${seoulShort(session.startsAt)} · ${areaName(session.areaId)} 회차가 삭제돼요. 이미 잡힌 예약이 있으면 함께 사라져요.`}
                  confirmLabel="삭제"
                  onConfirm={() => remove.mutate(session.id)}
                >
                  <Trash2 className="size-3.5" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <Form
        className="mt-3 grid gap-2 sm:grid-cols-5"
        onSubmit={() =>
          create.mutate({ ...form, programId: program.id, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt) })
        }
      >
        <SelectField
          value={form.areaId}
          onValueChange={set("areaId")}
          options={(areas.data ?? []).map((area) => ({ value: area.id, label: area.name }))}
          placeholder="구역"
          aria-label="구역"
        />
        <Input type="datetime-local" {...field("startsAt")} required />
        <Input type="datetime-local" {...field("endsAt")} required />
        <Input type="number" min={0} placeholder="정원" value={form.capacity ?? ""} onChange={(event) => set("capacity")(event.target.value === "" ? null : Number(event.target.value))} />
        <SubmitButton mutation={create} disabled={!form.areaId}>회차 추가</SubmitButton>
      </Form>
      <ErrorText error={create.error ?? remove.error} className="mt-2 text-[0.6875rem]" />
    </div>
  );
}

export default function ProgramsPage() {
  const resources = useQuery({ queryKey: ["operation-resources"], queryFn: fetchOperationResources });
  const programs = useQuery({ queryKey: ["admin-programs"], queryFn: fetchPrograms });
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");
  const [creating, setCreating] = useState(false);
  const { form, set, field, reset } = useForm<NewProgram>(EMPTY_PROGRAM);
  const [openSessions, setOpenSessions] = useState<string | null>(null);

  const invalidates = ["admin-programs", "operation-resources"];
  const create = useWrite(createProgram, {
    success: "프로그램을 등록했어요.", invalidates,
    onSuccess: () => { reset(); setCreating(false); },
  });
  const update = useWrite(updateProgram, { success: "프로그램을 수정했어요.", invalidates });
  const remove = useWrite(deleteProgram, { success: "프로그램을 보관했어요.", invalidates });
  const submitContent = useWrite(submitProgramContent, {
    success: "검수를 요청했어요. 검수·게시 관리 화면에서 승인하면 방문객에게 공개돼요.",
    invalidates: ["content-review"],
  });

  const filtered = category === "전체"
    ? resources.data ?? []
    : (resources.data ?? []).filter((row) => row.category === category);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (resources.data ?? []).forEach((row) => map.set(row.category, (map.get(row.category) ?? 0) + 1));
    return map;
  }, [resources.data]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        프로그램, 참여업체, 부스, 인력을 하나의 화면에서 통합 관리해요. 프로그램은 여기서 바로 등록·수정하고 회차를 추가할 수 있어요.
      </p>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-foreground">프로그램 관리</p>
          <Button size="sm" onClick={() => setCreating((value) => !value)}><Plus className="size-3.5" /> 프로그램 등록</Button>
        </div>

        {creating && (
          <Form
            className="mt-3 grid gap-3 sm:grid-cols-4"
            onSubmit={() => create.mutate({ ...form, summary: form.summary || undefined })}
          >
            <div className="space-y-1">
              <Label htmlFor="program-title">제목</Label>
              <Input id="program-title" {...field("title")} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="program-slug">슬러그</Label>
              <Input id="program-slug" {...field("slug")} required pattern="[a-z0-9-]+" placeholder="green-market" />
            </div>
            <div className="space-y-1">
              <Label>분류</Label>
              {/* 방문객 일정 화면이 이 값으로 한글 카테고리를 매핑한다 — 원시값을 직접 타이핑하지 않게 고정한다. */}
              <SelectField value={form.category} onValueChange={set("category")} options={PROGRAM_CATEGORIES} aria-label="분류" />
            </div>
            <div className="space-y-1">
              <Label>상태</Label>
              <SelectField value={form.status} onValueChange={set("status")} options={STATUS_OPTIONS} aria-label="상태" />
            </div>
            <div className="space-y-1 sm:col-span-4">
              <Label htmlFor="program-summary">소개</Label>
              <Textarea id="program-summary" rows={2} {...field("summary")} />
            </div>
            <div className="sm:col-span-4 flex items-center justify-end gap-3">
              <ErrorText error={create.error} className="mr-auto" />
              <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>취소</Button>
              <SubmitButton mutation={create} pending="등록 중...">등록</SubmitButton>
            </div>
          </Form>
        )}

        <div className="mt-3 space-y-2">
          <QueryState query={programs} skeleton={<Skeleton className="h-20 w-full rounded-xl" />}>
            {(rows) => (
              rows.map((program) => (
                <div key={program.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{program.title}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">{program.slug} · {program.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SelectField
                        value={program.status}
                        onValueChange={(status) => update.mutate({ id: program.id, version: program.version, status })}
                        options={STATUS_OPTIONS}
                        size="sm"
                        className="w-28"
                        aria-label="프로그램 상태"
                      />
                      <Button size="sm" variant="outline" onClick={() => setOpenSessions(openSessions === program.id ? null : program.id)}>회차</Button>
                      {/* 방문객 채널 노출은 콘텐츠 검수를 거친다. 내용을 고쳤으면 새 버전을 올려
                          검수를 다시 요청해야 공개 화면에 반영된다. */}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPendingFor(submitContent, program.id)}
                        onClick={() => submitContent.mutate(program)}
                      >
                        <FileCheck2 className="size-3.5" /> 검수 요청
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        aria-label="프로그램 보관"
                        disabled={isPendingFor(remove, program.id)}
                        title="프로그램을 보관할까요?"
                        description={`"${program.title}"이(가) 방문객 화면에서 내려갑니다. 회차와 예약 기록은 남아요.`}
                        confirmLabel="보관"
                        onConfirm={() => remove.mutate(program.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </div>
                  </div>
                  {openSessions === program.id && <SessionPanel program={program} />}
                </div>
              ))
            )}
          </QueryState>
        </div>
      </section>

      <Tabs value={category} onValueChange={(value) => setCategory(value as typeof category)}>
        <TabsList className="flex-wrap">
          {CATEGORIES.map((value) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              {value}
              {value !== "전체" && <span className="text-[0.625rem] text-muted-foreground">{counts.get(value) ?? 0}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <QueryState
          query={resources}
          className="m-4"
          empty="표시할 운영 자원이 없어요."
          emptyWhen={filtered.length === 0}
          skeleton={<SkeletonList count={5} className="h-10 w-full" wrapperClassName="p-4" />}
        >
          {() => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구분</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>위치</TableHead>
                  <TableHead>시간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><Badge variant="outline" className="text-[0.625rem]">{row.category}</Badge></TableCell>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.manager}</TableCell>
                    <TableCell className="text-muted-foreground">{row.location}</TableCell>
                    <TableCell className="text-muted-foreground">{row.time}</TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONE[row.status]} className="text-[0.6875rem]">{row.status}</StatusPill>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{row.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </div>
    </div>
  );
}
