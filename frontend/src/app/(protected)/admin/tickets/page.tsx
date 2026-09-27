"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, MessageSquareWarning, Plus, Sparkles } from "lucide-react";
import { createTicket, fetchTicketEvents, fetchTickets, transitionTicket, PRIORITY_TONE, TICKET_ACTION_LABEL, type NewTicket, type Ticket, type TicketType } from "@/entities/ticket";
import { fetchAreas } from "@/entities/area";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { Textarea } from "@/shared/ui/textarea";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState, queryErrorMessage } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import { StatusPill } from "@/shared/ui/status-pill";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { includesKeyword, useListView } from "@/shared/lib/use-list-view";
import { ListSearch, ShowMore } from "@/shared/ui/list-search";
import { seoulDateTime } from "@/shared/lib/utils";

const TYPES: (TicketType | "전체")[] = ["전체", "민원", "사고"];
const TYPE_ICON = { 민원: MessageSquareWarning, 사고: AlertTriangle } as const;
const STATUS_DOT = { 접수: "bg-slate-400", 배정됨: "bg-primary", 처리중: "bg-amber-500", 해결됨: "bg-emerald-500", 완료: "bg-muted-foreground" } as const;

const STATUS_FILTERS = ["처리 필요", "진행 중", "완료", "전체"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function matchesStatus(ticket: Ticket, filter: StatusFilter) {
  if (filter === "전체") return true;
  if (filter === "완료") return ticket.apiStatus === "CLOSED";
  if (filter === "처리 필요") return ticket.apiStatus === "OPEN" || ticket.apiStatus === "ASSIGNED";
  return ticket.apiStatus === "IN_PROGRESS" || ticket.apiStatus === "RESOLVED";
}

const TYPE_OPTIONS = [
  { value: "COMPLAINT", label: "민원" },
  { value: "INCIDENT", label: "사고" },
];

const PRIORITY_OPTIONS: { value: NewTicket["priority"]; label: string }[] = [
  { value: "LOW", label: "낮음" },
  { value: "NORMAL", label: "중간" },
  { value: "HIGH", label: "높음" },
  { value: "EMERGENCY", label: "긴급" },
];

const EMPTY_FORM: NewTicket = { ticketType: "COMPLAINT", title: "", description: "", priority: "NORMAL" };

function TicketHistory({ ticketId }: { ticketId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ticket-events", ticketId],
    queryFn: () => fetchTicketEvents(ticketId),
  });

  if (isLoading) return <Skeleton className="mt-3 h-16 w-full rounded-lg" />;
  if (isError) return <p className="mt-3 text-xs text-destructive">{queryErrorMessage(error)}</p>;

  return (
    <ol className="mt-3 space-y-1.5 border-t border-border pt-3">
      {(data ?? []).map((event) => (
        <li key={event.id} className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
          <Badge variant="outline" className="text-[0.625rem]">
            {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}
          </Badge>
          <span>{seoulDateTime(event.createdAt)}</span>
          {event.note && <span className="text-foreground">{event.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** 목록이 주인공인 화면이라 등록 폼은 목록을 밀어내지 않고 다이얼로그로 띄운다. */
function TicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>티켓 등록</DialogTitle>
          <DialogDescription>접수한 민원·사고를 담당자가 이어받을 수 있도록 상황을 남겨주세요.</DialogDescription>
        </DialogHeader>
        <TicketForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TicketForm({ onDone }: { onDone: () => void }) {
  const { form, set, field, reset } = useForm<NewTicket>(EMPTY_FORM);
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  const mutation = useWrite(createTicket, {
    success: "티켓을 접수했어요.",
    invalidates: ["tickets", "issue-analysis"],
    onSuccess: () => { reset(); onDone(); },
  });

  return (
    <Form className="space-y-3" onSubmit={() => mutation.mutate({ ...form, areaId: form.areaId || undefined })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ticket-title">제목</Label>
          <Input id="ticket-title" {...field("title")} required placeholder="예: 메인스테이지 대기열 혼잡" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>유형</Label>
            <SelectField
              value={form.ticketType}
              onValueChange={(value) => set("ticketType")(value as NewTicket["ticketType"])}
              options={TYPE_OPTIONS}
              aria-label="유형"
            />
          </div>
          <div className="space-y-1">
            <Label>우선순위</Label>
            <SelectField
              value={form.priority}
              onValueChange={(value) => set("priority")(value as NewTicket["priority"])}
              options={PRIORITY_OPTIONS}
              aria-label="우선순위"
            />
          </div>
          <div className="space-y-1">
            <Label>구역</Label>
            <SelectField
              value={form.areaId ?? "none"}
              onValueChange={(value) => set("areaId")(!value || value === "none" ? undefined : value)}
              options={[{ value: "none", label: "미지정" }, ...(areas.data ?? []).map((area) => ({ value: area.id, label: area.name }))]}
              aria-label="구역"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ticket-description">내용</Label>
        <Textarea id="ticket-description" {...field("description")} required rows={3} placeholder="현장 상황과 필요한 조치를 적어주세요." />
      </div>
      <ErrorText error={mutation.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <SubmitButton mutation={mutation} pending="등록 중...">티켓 등록</SubmitButton>
      </div>
    </Form>
  );
}

export default function TicketsPage() {
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: transitionTicket,
    meta: { success: "티켓 상태를 변경했어요." },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const [type, setType] = useState<(typeof TYPES)[number]>("전체");
  // 축제 중에는 완료 티켓이 쌓이므로 "처리 필요"를 기본으로 연다.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("처리 필요");
  const [creating, setCreating] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const byType = (tickets.data ?? []).filter((ticket) => type === "전체" || ticket.type === type);
  const byStatus = byType.filter((ticket) => matchesStatus(ticket, statusFilter));
  const list = useListView(byStatus, (ticket, keyword) =>
    includesKeyword(keyword, ticket.title, ticket.description, ticket.assignee, ticket.category),
  );
  const filtered = list.filtered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          민원·사고를 담당자·상태·우선순위별 티켓으로 관리해요. 상태는 바로 변경할 수 있어요.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> 티켓 등록
        </Button>
      </div>

      <TicketDialog open={creating} onOpenChange={setCreating} />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={type} onValueChange={(value) => setType(value as typeof type)}>
          <TabsList>
            {TYPES.map((value) => <TabsTrigger key={value} value={value}>{value}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <TabsList className="flex-wrap">
            {STATUS_FILTERS.map((value) => (
              <TabsTrigger key={value} value={value} className="gap-1.5">
                {value}
                <span className="text-[0.625rem] text-muted-foreground">
                  {byType.filter((ticket) => matchesStatus(ticket, value)).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <ListSearch
        value={list.query}
        onChange={list.setQuery}
        placeholder="제목·내용·담당자로 검색"
        count={filtered.length}
      />

      <QueryState
        query={tickets}
        skeleton={<SkeletonList count={4} className="h-24 w-full rounded-xl" />}
        empty="표시할 티켓이 없어요."
        emptyWhen={filtered.length === 0}
      >
        {() => (
          <div className="space-y-3">
            {list.visible.map((ticket: Ticket) => {
              const Icon = TYPE_ICON[ticket.type];
              return (
                <div key={ticket.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${STATUS_DOT[ticket.status]}/10`}>
                        <Icon className="size-4 text-foreground/70" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground">{ticket.title}</span>
                          <Badge variant="outline" className="text-[0.625rem]">{ticket.type}</Badge>
                          <StatusPill tone={PRIORITY_TONE[ticket.priority]}>
                            {ticket.priority}
                          </StatusPill>
                          {ticket.urgent && <Badge variant="destructive" className="text-[0.625rem]">긴급</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ticket.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
                          <span>담당자 {ticket.assignee}</span>
                          <span>{ticket.category}</span>
                          <span>{ticket.createdAt}</span>
                          <button
                            className="inline-flex items-center gap-1 font-medium text-primary"
                            onClick={() => setOpenHistory(openHistory === ticket.id ? null : ticket.id)}
                          >
                            <History className="size-3" /> 처리 이력
                          </button>
                        </div>
                        {ticket.aiTag && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-1 text-[0.625rem] font-semibold text-primary">
                            <Sparkles className="size-3" /> {ticket.aiTag}
                          </div>
                        )}
                        {openHistory === ticket.id && <TicketHistory ticketId={ticket.id} />}
                      </div>
                    </div>

                    <div className="flex w-full shrink-0 items-center gap-2 sm:w-36 sm:flex-col sm:items-end">
                      <Badge variant="outline" className="gap-1.5 text-[0.625rem]">
                        <span className={`size-1.5 rounded-full ${STATUS_DOT[ticket.status]}`} />
                        {ticket.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:w-full sm:flex-none"
                        onClick={() => mutation.mutate(ticket)}
                        disabled={isPendingFor(mutation, ticket.id) || ticket.apiStatus === "CLOSED"}
                      >
                        {TICKET_ACTION_LABEL[ticket.apiStatus]}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <ShowMore hidden={list.hidden} onShowMore={list.showMore} />
            {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
          </div>
        )}
      </QueryState>
    </div>
  );
}
