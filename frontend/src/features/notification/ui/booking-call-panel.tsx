"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { callBooking, type AdminBooking } from "@/entities/booking";
import { Button } from "@/shared/ui/button";
import { QueryState } from "@/shared/ui/query-state";
import { useWrite } from "@/shared/lib/use-write";
import { seoulMoment } from "@/shared/lib/utils";

export function BookingCallPanel({ query }: { query: UseQueryResult<AdminBooking[]> }) {
  const waiting = (query.data ?? []).filter((booking) => booking.status === "WAITING");
  const callMutation = useWrite(callBooking, {
    success: "방문객을 호출했어요.",
    invalidates: ["admin-bookings"],
  });

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-primary" />
        <h3 className="text-sm font-bold">예약 번호 호출</h3>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        대기 중인 예약을 호출하면 해당 방문객 화면의 알림에 바로 표시돼요.
      </p>
      <div className="space-y-2">
        <QueryState query={query} empty="호출할 대기 예약이 없어요." emptyWhen={waiting.length === 0}>
          {() =>
            waiting.map((booking) => (
              <div key={booking.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {booking.queueNumber ? `${booking.queueNumber}번 · ` : ""}
                    {booking.programTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seoulMoment(booking.startsAt)} · {booking.partySize}명
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={callMutation.isPending}
                  onClick={() => callMutation.mutate(booking.id)}
                >
                  <BellRing className="size-3.5" />
                  호출
                </Button>
              </div>
            ))
          }
        </QueryState>
      </div>
      {callMutation.error && <p className="text-xs text-destructive">{callMutation.error.message}</p>}
    </div>
  );
}
