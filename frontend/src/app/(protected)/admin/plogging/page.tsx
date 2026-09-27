"use client";

import { ACTIVITY_STATIONS, ActivityHeader, ActivityVisitorCode, ActivityScanner, ActivitySteps } from "@/features/activity-ui";

import { useState } from "react";
import { CheckCircle2, Clock3, Coins, QrCode, ScanLine, Trash2 } from "lucide-react";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import {
  PLOGGING_POINTS_PER_BAG,
  createPloggingSubmission,
  ploggingPoints,
  usePloggingSubmissions,
} from "@/features/plogging";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { StatCard } from "@/shared/ui/stat-card";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { ACTIVITY_QUERY_KEYS } from "@/features/activity-history";
import { isToday, seoulShort } from "@/shared/lib/utils";

const EMPTY_FORM = {
  visitorCode: "",
  bagCount: 1,
  location: ACTIVITY_STATIONS[0],
};

export default function AdminPloggingPage() {
  const user = useAdminSessionStore((state) => state.user);
  const submissions = usePloggingSubmissions(true);
  const { form, field, set, reset } = useForm(EMPTY_FORM);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  const canProcess = ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"].includes(user?.role ?? "");

  const verifiedToday = submissions.filter((submission) => isToday(submission.verifiedAt)).length;
  const pointsIssued = ploggingPoints(submissions);
  const bagsCollected = submissions.reduce((total, submission) => total + submission.bagCount, 0);

  const certify = useWrite(createPloggingSubmission, {
    invalidates: ACTIVITY_QUERY_KEYS,
    onSuccess: (submission) => {
      reset();
      setNotice(`${submission.submissionCode} 인증 완료 · +${submission.points}P 적립`);
    },
  });

  function submitVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProcess || certify.isPending || !form.visitorCode.trim()) return;
    certify.mutate(form);
  }

  function handleScan(value: string) {
    const code = value.trim();
    setScannerOpen(false);
    if (!code) return;
    set("visitorCode")(code);
    setNotice("방문객 코드가 입력됐어요. 봉투 수를 확인하고 인증하세요.");
  }

  return (
    <div className="space-y-5">
      <ActivityHeader icon={Trash2} title="플로깅 인증 관리"
        description="방문객이 주운 쓰레기를 확인하고 인증하면 ESG 포인트가 즉시 적립됩니다."
        user={user} roleDescription="플로깅 인증 처리 담당" pointsLabel={`봉투 1개당 +${PLOGGING_POINTS_PER_BAG}P`}
        canProcess={canProcess} readOnlyMessage="현재 계정은 조회 전용입니다. 인증 처리 권한이 있는 운영자 계정으로 로그인해 주세요." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="오늘 인증" value={`${verifiedToday}건`} helper="현장 처리 완료" icon={CheckCircle2} tone="success" />
        <StatCard label="누적 인증" value={`${submissions.length}건`} helper="전체 기간" icon={Clock3} tone="warning" />
        <StatCard label="수거 봉투" value={`${bagsCollected}개`} helper="누적 수거량" icon={Trash2} tone="primary" />
        <StatCard label="적립 ESG 포인트" value={`${pointsIssued.toLocaleString()}P`} helper="인증 완료 기준" icon={Coins} />
      </div>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">현장 인증</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">방문객 QR을 확인해 봉투 수를 입력하고 인증하세요.</p>
          </div>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submitVerification}>
          <ActivityVisitorCode field={field("visitorCode")} disabled={!canProcess} onScan={() => setScannerOpen((value) => !value)} />
          <div className="space-y-1">
            <Label htmlFor="bag-count">쓰레기 봉투 수</Label>
            <Input
              id="bag-count"
              type="number"
              min={1}
              max={20}
              value={form.bagCount}
              onChange={(event) => set("bagCount")(Number(event.target.value))}
              disabled={!canProcess}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>수거 지점</Label>
            <SelectField value={form.location} onValueChange={set("location")} options={ACTIVITY_STATIONS} disabled={!canProcess} />
          </div>
          <div className="flex items-end justify-end">
            <Button type="submit" className="w-full" disabled={!canProcess || certify.isPending || !form.visitorCode.trim()}>
              <CheckCircle2 className="size-4" /> 인증 완료
            </Button>
          </div>
        </form>

        {scannerOpen && (
          <ActivityScanner label="방문객 QR 스캔" onScan={handleScan}>카메라를 사용할 수 없으면 위 입력란에 직접 코드를 입력할 수 있어요.</ActivityScanner>
        )}
        {notice && <p className="mt-3 text-xs font-medium text-primary" role="status">{notice}</p>}
      </section>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">최근 인증 활동</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">인증 완료 내역과 적립 포인트는 방문객 기기에서도 확인할 수 있습니다.</p>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]"><QrCode className="size-3" /> TRASH_PICKUP</Badge>
        </div>
        {submissions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <Trash2 className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">아직 인증한 건이 없어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">위에서 방문객 코드를 입력해 첫 인증을 등록하세요.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {submissions.slice(0, 8).map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{submission.submissionCode} · {submission.visitorCode}</p>
                    <p className="truncate text-[11px] text-muted-foreground">쓰레기 {submission.bagCount}봉투 · {submission.location} · {seoulShort(submission.verifiedAt)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">+{submission.points}P 적립</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <ActivitySteps steps={[
        { icon: ScanLine, title: "1. 스캔", description: "방문객 QR을 스캔하거나 코드를 입력합니다." },
        { icon: Trash2, title: "2. 확인", description: "수거한 쓰레기 봉투 수를 입력합니다." },
        { icon: Coins, title: "3. 적립", description: `인증 완료 즉시 봉투당 +${PLOGGING_POINTS_PER_BAG}P를 기록합니다.` },
      ]} footer="인증을 완료하면 방문객의 포인트 내역에도 반영됩니다." />
    </div>
  );
}
