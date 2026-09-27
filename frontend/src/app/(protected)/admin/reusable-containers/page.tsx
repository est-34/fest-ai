"use client";

import { ACTIVITY_STATIONS, ActivityHeader, ActivityVisitorCode, ActivityScanner, ActivitySteps } from "@/features/activity-ui";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock3, Coins, QrCode, Recycle } from "lucide-react";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import {
  CONTAINER_TYPE_LABEL,
  REUSABLE_STAMP_POINTS,
  completeContainerReturn,
  createContainerRental,
  reusableContainerPoints,
  useReusableContainerRentals,
  type ContainerType,
} from "@/features/reusable-containers";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { StatCard } from "@/shared/ui/stat-card";
import { StatusPill } from "@/shared/ui/status-pill";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { ACTIVITY_QUERY_KEYS } from "@/features/activity-history";
import { isToday, seoulShort } from "@/shared/lib/utils";

type FlowMode = "RENT" | "RETURN";

const EMPTY_RENT_FORM = {
  visitorCode: "",
  containerType: "CUP" as ContainerType,
  quantity: 1,
  station: ACTIVITY_STATIONS[0],
};

export default function ReusableContainersPage() {
  const user = useAdminSessionStore((state) => state.user);
  const rentals = useReusableContainerRentals(true);
  const [mode, setMode] = useState<FlowMode>("RENT");
  const { form: rentalForm, field: rentalField, set: setRentalField, reset: resetRentalForm } = useForm(EMPTY_RENT_FORM);
  const [returnRentalId, setReturnRentalId] = useState("");
  const [scannerMode, setScannerMode] = useState<FlowMode | null>(null);
  const [notice, setNotice] = useState<string>();

  const canProcess = ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR"].includes(user?.role ?? "");

  const activeRentals = rentals.filter((rental) => rental.status === "RENTED").sort((a, b) => b.rentedAt.localeCompare(a.rentedAt));
  const returnedRentals = rentals.filter((rental) => rental.status === "RETURNED");
  const returnedToday = returnedRentals.filter((rental) => isToday(rental.returnedAt)).length;
  const returnRate = rentals.length ? Math.round((returnedRentals.length / rentals.length) * 100) : 0;
  const pointsIssued = reusableContainerPoints(rentals);
  // 고른 대여 건이 목록에서 사라지면(반납 처리·다른 탭 변경) 첫 건으로 되돌아간다.
  // 상태를 고쳐 쓰는 대신 렌더에서 고르면 선택이 한 박자 늦게 따라오는 일이 없다.
  const selectedRental = activeRentals.find((rental) => rental.id === returnRentalId) ?? activeRentals[0];
  const selectedId = selectedRental?.id ?? "";

  const rent = useWrite(createContainerRental, {
    invalidates: ACTIVITY_QUERY_KEYS,
    onSuccess: (rental) => {
      resetRentalForm();
      setReturnRentalId(rental.id);
      setMode("RETURN");
      setNotice(`${rental.rentalCode} 대여를 등록했어요. 반납 시 스탬프가 적립됩니다.`);
    },
  });
  const returnRental = useWrite(completeContainerReturn, {
    invalidates: ACTIVITY_QUERY_KEYS,
    onSuccess: (rental) => setNotice(`${rental.rentalCode} 반납 완료 · +${REUSABLE_STAMP_POINTS}P 적립`),
  });

  function submitRental(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProcess || rent.isPending || !rentalForm.visitorCode.trim()) return;
    rent.mutate(rentalForm);
  }

  function submitReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProcess || returnRental.isPending || !selectedId) return;
    returnRental.mutate(selectedId);
  }

  function handleScan(value: string) {
    const code = value.trim();
    setScannerMode(null);
    if (!code) return;
    if (mode === "RENT") {
      setRentalField("visitorCode")(code);
      setNotice("방문객 코드가 입력됐어요. 대여 정보를 확인하고 등록하세요.");
      return;
    }
    const rental = activeRentals.find((item) => item.rentalCode === code.toUpperCase() || item.visitorCode === code.toUpperCase());
    if (!rental) {
      setNotice("반납 대기 중인 대여 코드를 찾지 못했어요.");
      return;
    }
    setReturnRentalId(rental.id);
    setNotice(`${rental.rentalCode} 반납 건을 선택했어요.`);
  }

  return (
    <div className="space-y-5">
      <ActivityHeader icon={Recycle} title="재사용기 대여·반납 관리"
        description="반납 완료를 기록하면 방문객의 REUSABLE_CUP 스탬프와 ESG 포인트 적립 상태로 연계합니다."
        user={user} roleDescription="대여·반납 처리 담당" pointsLabel={`반납 1건당 +${REUSABLE_STAMP_POINTS}P`}
        canProcess={canProcess} readOnlyMessage="현재 계정은 조회 전용입니다. 대여·반납 처리 권한이 있는 운영자 계정으로 로그인해 주세요." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="대여 중" value={`${activeRentals.length}건`} helper="반납 대기 용기" icon={Clock3} tone="warning" />
        <StatCard label="오늘 반납" value={`${returnedToday}건`} helper="현장 회수 완료" icon={CheckCircle2} tone="success" />
        <StatCard label="반납률" value={`${returnRate}%`} helper={`${rentals.length}건 기준`} icon={Recycle} tone="primary" />
        <StatCard label="연계 ESG 포인트" value={`${pointsIssued.toLocaleString()}P`} helper="반납 완료 기준" icon={Coins} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">현장 처리</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">방문객 코드 또는 대여 QR을 확인해 대여·반납을 기록하세요.</p>
          </div>
          <Tabs value={mode} onValueChange={(value) => { setMode((value ?? "RENT") as FlowMode); setNotice(undefined); }}>
            <TabsList>
              <TabsTrigger value="RENT"><ArrowUpFromLine className="size-3.5" /> 대여</TabsTrigger>
              <TabsTrigger value="RETURN"><ArrowDownToLine className="size-3.5" /> 반납</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === "RENT" ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submitRental}>
            <ActivityVisitorCode field={rentalField("visitorCode")} disabled={!canProcess} onScan={() => setScannerMode("RENT")} />
            <div className="space-y-1">
              <Label>용기 종류</Label>
              <SelectField
                value={rentalForm.containerType}
                onValueChange={(value) => setRentalField("containerType")(value as ContainerType)}
                options={Object.entries(CONTAINER_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                disabled={!canProcess}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="container-quantity">수량</Label>
              <Input id="container-quantity" type="number" min={1} max={20} value={rentalForm.quantity} onChange={(event) => setRentalField("quantity")(Number(event.target.value))} disabled={!canProcess} required />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label>대여 지점</Label>
              <SelectField value={rentalForm.station} onValueChange={setRentalField("station")} options={ACTIVITY_STATIONS} disabled={!canProcess} />
            </div>
            <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
              <Button type="submit" className="w-full" disabled={!canProcess || rent.isPending || !rentalForm.visitorCode.trim()}><ArrowUpFromLine className="size-4" /> 대여 등록</Button>
            </div>
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitReturn}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1">
                <Label>반납 대여 건</Label>
                <SelectField
                  value={selectedId || "none"}
                  onValueChange={(value) => setReturnRentalId(value === "none" ? "" : value)}
                  options={activeRentals.length === 0
                    ? [{ value: "none", label: "반납 대기 중인 대여 없음" }]
                    : activeRentals.map((rental) => ({ value: rental.id, label: `${rental.rentalCode} · ${rental.visitorCode} · ${rental.quantity}개` }))}
                  placeholder="반납 대여 건 선택"
                  disabled={!canProcess}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={!canProcess} onClick={() => setScannerMode("RETURN")}><QrCode className="size-3.5" /> 대여 QR 확인</Button>
                <Button type="submit" disabled={!canProcess || returnRental.isPending || !selectedId}><CheckCircle2 className="size-3.5" /> 반납 완료</Button>
              </div>
            </div>
            {selectedRental && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <span className="font-semibold text-foreground">{CONTAINER_TYPE_LABEL[selectedRental.containerType]} {selectedRental.quantity}개</span>
                <span className="text-muted-foreground">{selectedRental.station}</span>
                <span className="text-muted-foreground">대여 {seoulShort(selectedRental.rentedAt)}</span>
                <Badge variant="outline" className="text-[10px]">반납 시 +{REUSABLE_STAMP_POINTS}P</Badge>
              </div>
            )}
          </form>
        )}

        {scannerMode && (
          <ActivityScanner label={mode === "RENT" ? "방문객 QR 스캔" : "대여 QR 스캔"} onScan={handleScan}>카메라를 사용할 수 없으면 위 입력·목록에서 직접 선택할 수 있어요.</ActivityScanner>
        )}
        {notice && <p className="mt-3 text-xs font-medium text-primary" role="status">{notice}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">최근 대여·반납 활동</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">반납 완료 건은 방문객 스탬프 연계 대상으로 표시됩니다.</p>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]"><Coins className="size-3" /> REUSABLE_CUP</Badge>
        </div>
        {rentals.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <Recycle className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">아직 처리한 대여 건이 없어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">위에서 방문객 코드를 입력해 첫 대여를 등록하세요.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {rentals.slice(0, 8).map((rental) => (
              <div key={rental.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${rental.status === "RETURNED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {rental.status === "RETURNED" ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{rental.rentalCode} · {rental.visitorCode}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{CONTAINER_TYPE_LABEL[rental.containerType]} {rental.quantity}개 · {rental.station} · {seoulShort(rental.returnedAt ?? rental.rentedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={rental.status === "RETURNED" ? "success" : "warning"}>{rental.status === "RETURNED" ? "반납 완료" : "대여 중"}</StatusPill>
                  {rental.stampStatus === "ISSUED" && <Badge variant="secondary" className="text-[10px]">+{rental.stampPoints}P 적립</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ActivitySteps steps={[
        { icon: ArrowUpFromLine, title: "1. 대여", description: "방문객 코드와 용기 수량을 기록합니다." },
        { icon: ArrowDownToLine, title: "2. 반납", description: "대여 건을 선택해 회수를 완료합니다." },
        { icon: Coins, title: "3. 스탬프", description: `반납 완료 상태와 +${REUSABLE_STAMP_POINTS}P를 방문객 화면에 표시합니다.` },
      ]} footer="처리 결과는 방문객 화면에도 반영되며, 같은 반납 건은 한 번만 적립됩니다." />
    </div>
  );
}
