"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Scale, ShieldCheck } from "lucide-react";
import {
  createPrivacyRequest,
  fetchPrivacyNotice,
  fetchPrivacyRequests,
  updateConsents,
} from "@/features/privacy/api/privacy";
import { useAutoTranslate, useTranslation } from "@/shared/lib/i18n";
import { useWrite } from "@/shared/lib/use-write";
import { Button } from "@/shared/ui/button";
import { QueryState, queryErrorMessage } from "@/shared/ui/query-state";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";

/**
 * OPS-11 방문객 개인정보 화면.
 *
 * 항목별 수집 근거·보유기간을 그대로 보여주고, 철회 가능한 항목만 끌 수 있게 한다.
 * 열람·삭제 요구의 본인확인은 이 화면이 이미 들고 있는 VIS-11 방문 세션 식별자로 갈음한다.
 * 익명 설문 응답은 제출 이후 응답자를 특정할 수 없어 요구 대상에서 제외된다는 사실을 함께 고지한다.
 */
export default function VisitorPrivacyPage() {
  const { t, locale, bcp47 } = useTranslation();
  const notice = useQuery({ queryKey: ["privacy-notice"], queryFn: fetchPrivacyNotice });
  const requests = useQuery({ queryKey: ["privacy-requests"], queryFn: fetchPrivacyRequests });
  const [detail, setDetail] = useState("");

  const consent = useWrite((next: Record<string, boolean>) => updateConsents(next), {
    invalidates: ["privacy-notice"],
  });
  // 접수 결과가 목록에 바로 드러나므로 알림은 띄우지 않는다(meta.silent).
  const request = useWrite((type: "ACCESS" | "DELETE") => createPrivacyRequest(type, detail || undefined), {
    silent: true,
    invalidates: ["privacy-requests"],
    onSuccess: () => setDetail(""),
  });

  // 항목 정의는 서버가 한국어로 내려주므로 다른 언어에서는 요청 시점에 번역한다.
  const { translated } = useAutoTranslate(
    Object.fromEntries([
      ...(notice.data?.items ?? []).flatMap((item) => [
        [`${item.key}.label`, item.label],
        [`${item.key}.basis`, item.basis],
        [`${item.key}.retention`, item.retention],
        ...(item.notice ? [[`${item.key}.notice`, item.notice] as [string, string]] : []),
      ]),
      ...(notice.data?.retentionPolicy ?? []).flatMap((row) => [
        [`policy.${row.key}.label`, row.label],
        [`policy.${row.key}.retention`, row.retention],
      ]),
    ]),
    locale,
  );

  return (
    <div className="px-4 pt-4 pb-8">
      <h1 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
        <ShieldCheck className="size-5 text-primary" />
        {t.privacy.title}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">{t.privacy.subtitle}</p>

      <QueryState query={notice} className="mt-4" errorMessage={t.common.loadFailed} retryLabel={t.common.retry}>
        {(data) => (
          <>
            <section className="mt-4">
              <h2 className="text-sm font-bold text-foreground">{t.privacy.consentTitle}</h2>
              <div className="mt-2 space-y-2">
                {data.items.map((item) => {
                  const granted = data.consents[item.key] !== false;
                  return (
                    <div key={item.key} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {translated[`${item.key}.label`] ?? item.label}
                            <span className="ml-1.5 text-[0.625rem] font-medium text-muted-foreground">{item.featureId}</span>
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {translated[`${item.key}.basis`] ?? item.basis}
                          </p>
                          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                            {t.privacy.retentionLabel}: {translated[`${item.key}.retention`] ?? item.retention}
                          </p>
                          {item.notice && (
                            <p className="mt-1 text-[0.6875rem] font-medium text-amber-700">
                              {translated[`${item.key}.notice`] ?? item.notice}
                            </p>
                          )}
                        </div>
                        {item.withdrawable ? (
                          <Switch
                            checked={granted}
                            onCheckedChange={(checked) => consent.mutate({ [item.key]: checked })}
                            aria-label={item.label}
                          />
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-bold text-muted-foreground">
                            {t.privacy.required}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {consent.data && Object.values(consent.data.purged).some((count) => count > 0) && (
                <p className="mt-2 text-[0.6875rem] font-medium text-primary">{t.privacy.purgedNotice}</p>
              )}
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-bold text-foreground">{t.privacy.retentionTitle}</h2>
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {data.retentionPolicy.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-3 p-3 text-xs">
                    <span className="font-semibold text-foreground">
                      {translated[`policy.${row.key}.label`] ?? row.label}
                    </span>
                    <span className="shrink-0 text-right text-muted-foreground">
                      {translated[`policy.${row.key}.retention`] ?? row.retention}
                      {row.mode === "NOT_COLLECTED" && ` · ${t.privacy.notCollected}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </QueryState>

      <section className="mt-6">
        <h2 className="text-sm font-bold text-foreground">{t.privacy.requestTitle}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.privacy.requestDescription}</p>
        <p className="mt-1 text-[0.6875rem] leading-5 text-amber-700">{t.privacy.requestExcluded}</p>
        <Textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={t.privacy.requestPlaceholder}
          className="mt-2 min-h-20"
        />
        {request.error && (
          <p className="mt-2 text-xs text-destructive">{queryErrorMessage(request.error, t.privacy.requestFailed)}</p>
        )}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={request.isPending} onClick={() => request.mutate("ACCESS")}>
            {t.privacy.requestAccess}
          </Button>
          <Button variant="destructive" className="flex-1" disabled={request.isPending} onClick={() => request.mutate("DELETE")}>
            {t.privacy.requestDelete}
          </Button>
        </div>

        <QueryState
          query={requests}
          className="mt-3"
          empty={t.privacy.noRequests}
          errorMessage={t.common.loadFailed}
          retryLabel={t.common.retry}
        >
          {(rows) => (
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {row.requestType === "DELETE" ? t.privacy.requestDelete : t.privacy.requestAccess}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-bold text-muted-foreground">
                      {t.privacy.status[row.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString(bcp47)}
                    {row.handledAt && ` → ${new Date(row.handledAt).toLocaleString(bcp47)}`}
                  </p>
                  {row.result?.collected && (
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                      {Object.entries(row.result.collected)
                        .map(([key, value]) => `${key} ${value}`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>

      {/* 오픈소스 고지는 개인정보 화면 아래에 둔다 — 홈에서 따로 찾아갈 만한 내용이 아니다. */}
      <Link
        href="/visitor/licenses"
        className="mt-6 flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs font-semibold text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Scale className="size-4 text-primary" /> 오픈소스 라이선스
        </span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
