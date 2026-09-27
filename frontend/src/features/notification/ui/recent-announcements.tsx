"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  SEVERITY_OPTIONS,
  STATUS_LABEL,
  canClose,
  closeAnnouncement,
  type Announcement,
  type AnnouncementSeverity,
} from "@/entities/announcement";
import { Button } from "@/shared/ui/button";
import { QueryState } from "@/shared/ui/query-state";
import { StatusPill, type Tone } from "@/shared/ui/status-pill";
import { useWrite } from "@/shared/lib/use-write";
import { seoulMoment } from "@/shared/lib/utils";

const SEVERITY_TONE: Record<AnnouncementSeverity, Tone> = {
  INFO: "secondary",
  WARNING: "warning",
  EMERGENCY: "danger",
};

export function RecentAnnouncements({ query }: { query: UseQueryResult<Announcement[]> }) {
  const closeMutation = useWrite(closeAnnouncement, {
    success: "공지 노출을 종료했어요.",
    invalidates: ["announcements"],
  });

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold text-muted-foreground">최근 공지</h3>
      <div className="space-y-2">
        <QueryState query={query} empty="발행된 공지가 없어요.">
          {(announcements) =>
            announcements.slice(0, 4).map((announcement) => (
              <div key={announcement.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <StatusPill tone={SEVERITY_TONE[announcement.severity]} className="shrink-0">
                  {SEVERITY_OPTIONS.find((option) => option.value === announcement.severity)?.label}
                </StatusPill>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{announcement.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {STATUS_LABEL[announcement.status]}
                    {announcement.startsAt && ` · ${seoulMoment(announcement.startsAt)}`}
                    {announcement.endsAt && ` ~ ${seoulMoment(announcement.endsAt)}`}
                  </p>
                </div>
                {canClose(announcement.status) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate(announcement.id)}
                    aria-label={`${announcement.title} 공지 종료`}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))
          }
        </QueryState>
      </div>
    </div>
  );
}
