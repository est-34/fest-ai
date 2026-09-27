"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Megaphone, Send, ShieldAlert } from "lucide-react";
import { fetchAreas } from "@/entities/area";
import {
  AUDIENCE_OPTIONS,
  SEVERITY_OPTIONS,
  publishAnnouncement,
  validatePublishInput,
  type AnnouncementSeverity,
} from "@/entities/announcement";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import { canPublishEmergency } from "@/shared/lib/permissions";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { datetimeLocal, seoulMoment, toggleValue, toIso } from "@/shared/lib/utils";

type PublishMode = "now" | "scheduled";

export function AnnouncementPublishForm() {
  const role = useAdminSessionStore((state) => state.user?.role);
  const emergencyAllowed = canPublishEmergency(role);
  const { data: areaOptions = [] } = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });

  const publishMutation = useWrite(publishAnnouncement, {
    success: "공지를 발행했어요.",
    invalidates: ["announcements"],
    onSuccess: () => reset(),
  });

  const { form, set, field, reset } = useForm(() => ({
    title: "",
    body: "",
    severity: "INFO" as AnnouncementSeverity,
    audience: [] as string[],
    targetAreaIds: [] as string[],
    publishMode: "now" as PublishMode,
    startsAt: datetimeLocal(),
    endsAt: "",
  }));
  const { title, body, severity, audience, targetAreaIds, publishMode, startsAt, endsAt } = form;

  // 즉시 게시는 "발행 버튼을 누른 시각"이 노출 시작이므로 입력값을 검증에서 제외한다.
  const validationError =
    publishMode === "scheduled"
      ? validatePublishInput({ title, audience, startsAt, endsAt })
      : (validatePublishInput({ title, audience, startsAt: datetimeLocal(), endsAt: "" }) ??
        (endsAt && new Date(endsAt) <= new Date()
          ? "자동 해제 시각은 현재 시각 이후여야 해요."
          : null));
  const severityBlocked = severity === "EMERGENCY" && !emergencyAllowed;
  const canPublish = !validationError && !severityBlocked && !publishMutation.isPending;

  function publishNotice() {
    if (!canPublish) return;
    publishMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      severity,
      audience,
      targetAreaIds,
      startsAt: publishMode === "now" ? toIso(new Date()) : toIso(startsAt),
      endsAt: endsAt ? toIso(endsAt) : undefined,
    });
  }

  return (
    // 방문객 전체로 나가는 되돌릴 수 없는 발행이라, Enter 제출 대신 확인 단계를 반드시 거치게 한다.
    <form
      onSubmit={(event) => event.preventDefault()}
      className="space-y-3 rounded-2xl border border-border bg-background p-4"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-primary" />
        <h3 className="text-sm font-bold">공지사항 발행</h3>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notice-title">공지 제목</Label>
        <Input id="notice-title" {...field("title")} placeholder="예: 메인스테이지 운영 안내" maxLength={200} />
      </div>

      {/* 예전에는 제목만 보내서 방문객 알림에 본문이 없었고, 화면이 "자세한 내용은 운영
          안내를 확인해 주세요"라는 기본 문구만 보여줬다. */}
      <div className="space-y-1.5">
        <Label htmlFor="notice-body">공지 본문</Label>
        <Textarea
          id="notice-body"
          rows={3}
          {...field("body")}
          placeholder="방문객에게 보일 내용을 적어주세요. 비워두면 제목이 그대로 표시돼요."
          maxLength={4000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>긴급도</Label>
        <div className="flex flex-wrap gap-2">
          {SEVERITY_OPTIONS.map((option) => {
            const blocked = option.value === "EMERGENCY" && !emergencyAllowed;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={severity === option.value ? "default" : "outline"}
                disabled={blocked}
                title={blocked ? "긴급 공지는 최고 관리자만 발행할 수 있어요." : undefined}
                onClick={() => set("severity")(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        {!emergencyAllowed && (
          <p className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
            <ShieldAlert className="size-3" />
            긴급 공지는 최고 관리자 권한이 필요해요. 긴급 상황이면 최고 관리자에게 발행을 요청하세요.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>노출 대상 (최소 1개)</Label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={audience.includes(option.value) ? "default" : "outline"}
              onClick={() => set("audience")(toggleValue(audience, option.value))}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {areaOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label>노출 구역 (선택, 비우면 전체 구역)</Label>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map((area) => (
              <Button
                key={area.id}
                type="button"
                size="sm"
                variant={targetAreaIds.includes(area.id) ? "default" : "outline"}
                onClick={() => set("targetAreaIds")(toggleValue(targetAreaIds, area.id))}
              >
                {area.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>게시 방식</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={publishMode === "now" ? "default" : "outline"}
            onClick={() => set("publishMode")("now")}
          >
            <Send className="size-3.5" /> 즉시 게시
          </Button>
          <Button
            type="button"
            size="sm"
            variant={publishMode === "scheduled" ? "default" : "outline"}
            onClick={() => {
              set("publishMode")("scheduled");
              // 예약으로 바꾸는 시점의 현재 시각을 기본값으로 다시 채운다(폼을 오래 열어둔 경우 대비).
              set("startsAt")(datetimeLocal());
            }}
          >
            <CalendarClock className="size-3.5" /> 예약 게시
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {publishMode === "scheduled" && (
          <div className="space-y-1.5">
            <Label htmlFor="notice-starts-at">노출 시작</Label>
            <Input id="notice-starts-at" type="datetime-local" {...field("startsAt")} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="notice-ends-at">자동 해제 시각 (선택)</Label>
          <Input
            id="notice-ends-at"
            type="datetime-local"
            min={publishMode === "scheduled" ? startsAt : undefined}
            {...field("endsAt")}
          />
        </div>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        {publishMode === "now"
          ? "발행 버튼을 누른 시각부터 방문객 화면에 노출돼요."
          : "지정한 시각이 되면 방문객 화면에 노출돼요. 그 전까지는 '노출 예정' 상태로 남아요."}{" "}
        자동 해제 시각을 비워두면 직접 종료할 때까지 노출돼요.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {validationError && <p className="mr-auto text-xs text-muted-foreground">{validationError}</p>}
        <ConfirmButton
          size="sm"
          disabled={!canPublish}
          title={severity === "EMERGENCY" ? "긴급 공지를 발행할까요?" : "공지를 발행할까요?"}
          description={
            <span className="block space-y-1">
              <span className="block font-medium text-foreground">{title.trim()}</span>
              <span className="block">
                {SEVERITY_OPTIONS.find((option) => option.value === severity)?.label}
                {" · "}
                {audience
                  .map((value) => AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? value)
                  .join(", ")}
                {" · "}
                {targetAreaIds.length === 0
                  ? "전체 구역"
                  : targetAreaIds.map((id) => areaOptions.find((area) => area.id === id)?.name ?? id).join(", ")}
              </span>
              <span className="block">
                {seoulMoment(startsAt)}부터{" "}
                {endsAt ? `${seoulMoment(endsAt)}까지` : "직접 종료할 때까지"} 노출돼요.
              </span>
              {severity === "EMERGENCY" && (
                <span className="block text-destructive">
                  대상 방문객 화면 상단에 즉시 고정되고, 되돌리려면 직접 종료해야 해요.
                </span>
              )}
            </span>
          }
          confirmLabel="발행"
          onConfirm={publishNotice}
        >
          <Send className="size-3.5" />
          공지 발행
        </ConfirmButton>
      </div>
    </form>
  );
}
