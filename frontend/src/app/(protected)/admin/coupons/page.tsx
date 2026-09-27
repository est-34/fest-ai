"use client";

import { useCallback, useState } from "react";
import { BadgeCheck, ScanLine } from "lucide-react";
import { isCouponToken, redeemCouponOnSite, type CouponRedemption } from "@/features/coupon-redemption/api/redeem";
import { QrScanner } from "@/shared/ui/qr-scanner";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { seoulDateTime } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";

export default function AdminCouponsPage() {
  const [token, setToken] = useState("");
  const [history, setHistory] = useState<CouponRedemption[]>([]);
  const [inputError, setInputError] = useState<string>();

  const redeem = useWrite(redeemCouponOnSite, {
    onSuccess: (redemption) => {
      setHistory((current) => [redemption, ...current].slice(0, 20));
      setToken("");
    },
  });

  const submitToken = useCallback((value: string) => {
    if (!isCouponToken(value)) {
      setInputError("쿠폰 코드 형식이 아니에요. 방문객 화면의 코드를 다시 확인해 주세요.");
      return;
    }
    setInputError(undefined);
    redeem.mutate(value);
  }, [redeem]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        방문객이 보여주는 쿠폰 QR을 읽거나 코드를 입력해 현장에서 사용 처리해요. 처리하면 되돌릴 수 없어요.
      </p>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ScanLine className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">쿠폰 사용 처리</h2>
        </div>

        <QrScanner onScan={submitToken} label="카메라로 쿠폰 QR 스캔" />

        <Form onSubmit={() => submitToken(token)} className="space-y-2">
          <Label htmlFor="coupon-token">쿠폰 코드</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="coupon-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="cp_..."
              autoComplete="off"
              className="min-w-56 flex-1"
            />
            <SubmitButton mutation={redeem} size="default" disabled={!token.trim()}>
              <BadgeCheck className="size-4" />
              {redeem.isPending ? "처리 중…" : "사용 처리"}
            </SubmitButton>
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            카메라 스캔이 안 되는 기기에서는 방문객 화면에 표시된 코드를 그대로 입력하세요.
          </p>
        </Form>

        {inputError && <p className="text-xs text-destructive" role="alert">{inputError}</p>}
        <ErrorText error={redeem.error} fallback="사용 처리에 실패했어요." />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold text-muted-foreground">이번 접속에서 처리한 쿠폰</h3>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            아직 처리한 쿠폰이 없어요.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((redemption) => (
              <div key={redemption.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{redemption.couponName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seoulDateTime(redemption.redeemedAt)} 사용 처리
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
