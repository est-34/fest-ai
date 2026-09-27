"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, Fingerprint, Radio, ShieldCheck, Trash2 } from "lucide-react";
import {
  PRIVACY_REQUEST_STATUS_LABEL,
  fetchAdminPrivacyRequests,
  fetchDeliveryReport,
  fetchIdentityReview,
  fetchKioskCameraReport,
  fetchPrivacyPolicy,
  handlePrivacyRequest,
  runPrivacyPurge,
  updateKioskCamera,
} from "@/features/privacy-admin";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { QueryState } from "@/shared/ui/query-state";
import { useWrite } from "@/shared/lib/use-write";
import { SkeletonList } from "@/shared/ui/skeleton";
import { StatCard } from "@/shared/ui/stat-card";
import { StatusPill, type Tone } from "@/shared/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { seoulDateTime } from "@/shared/lib/utils";

const STATUS_TONE: Record<string, Tone> = {
  RECEIVED: "warning",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  REJECTED: "muted",
};

const MODE_LABEL: Record<string, string> = {
  AUTO: "자동 파기",
  MANUAL: "수동 관리",
  NOT_COLLECTED: "수집 안 함",
};

/** 분모가 없는 비율은 0%가 아니라 "아직 없음"이다. 섞으면 중지 판단을 잘못하게 된다. */
function percent(value: number | null) {
  return value === null ? "집계 전" : `${Math.round(value * 100)}%`;
}

function time(value: string | null | undefined) {
  return value ? seoulDateTime(value) : "-";
}

/**
 * 게시부터 최초 노출까지 걸린 시간.
 *
 * 완료 기준이 "30초 이내"라 정상 범위는 초 단위지만, 예약 게시나 오래 열려 있던 공지는
 * 값이 수천만 초까지 나와서 그대로 찍으면 읽을 수 없다.
 */
function lag(seconds: number | null) {
  if (seconds === null) return "-";
  const value = Math.max(seconds, 0);
  if (value < 120) return `${value}초`;
  if (value < 7200) return `${Math.round(value / 60)}분`;
  if (value < 172800) return `${Math.round(value / 3600)}시간`;
  return `${Math.round(value / 86400)}일`;
}

/**
 * OPS-11 개인정보 · VIS-11 식별자 · OPS-10 전달 결과를 한 화면에 모읍니다.
 *
 * 세 가지 모두 "방문객 데이터를 어떻게 다루고 있는가"를 확인하는 화면이라 흩어 두면
 * 감사·점검 때 여러 메뉴를 오가야 합니다.
 */
export default function AdminPrivacyPage() {
  const role = useAdminSessionStore((state) => state.user?.role);
  const policy = useQuery({ queryKey: ["privacy-policy"], queryFn: fetchPrivacyPolicy });
  const requests = useQuery({ queryKey: ["privacy-requests-admin"], queryFn: fetchAdminPrivacyRequests });
  const identity = useQuery({ queryKey: ["visitor-identity"], queryFn: fetchIdentityReview });
  const deliveries = useQuery({ queryKey: ["notification-deliveries"], queryFn: fetchDeliveryReport });
  const kioskCamera = useQuery({ queryKey: ["kiosk-camera-report"], queryFn: fetchKioskCameraReport });
  const [stopReason, setStopReason] = useState("");

  const handle = useWrite(handlePrivacyRequest, {
    success: "요구 처리 상태를 변경했어요.", invalidates: ["privacy-requests-admin"],
  });
  const purge = useWrite(runPrivacyPurge, {
    success: "보유기간이 지난 개인정보를 파기했어요.", invalidates: ["privacy-policy"],
  });
  const camera = useWrite(updateKioskCamera, {
    success: "키오스크 카메라 제안 설정을 변경했어요.",
    invalidates: ["kiosk-camera-report"],
    onSuccess: () => setStopReason(""),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ShieldCheck className="size-5 text-primary" /> 개인정보·전달 관리
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          항목별 보유기간과 파기 실행, 정보주체의 열람·삭제 요구 처리, 식별자 재발급 검토, 공지 도달 결과를 확인해요.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">항목별 보유기간 정책</h2>
          {role === "SUPER_ADMIN" && (
            <ConfirmButton
              size="sm"
              variant="destructive"
              title="지금 파기를 실행할까요?"
              description="보유기간이 지난 항목이 참조 데이터까지 연쇄 파기되고 결과가 감사 로그에 남습니다. 되돌릴 수 없습니다."
              confirmLabel="파기 실행"
              onConfirm={() => purge.mutate()}
            >
              <Trash2 className="size-3.5" /> 즉시 파기
            </ConfirmButton>
          )}
        </div>
        <QueryState query={policy} skeleton={<SkeletonList count={3} className="h-10 rounded-lg" wrapperClassName="space-y-2" />}>
          {(data) => (
            <>
              <p className="mb-2 text-[0.6875rem] text-muted-foreground">
                파기 주기 {data.purgeSchedule} · 최근 파기 {time(data.lastPurge?.createdAt)}
                {data.lastPurge && ` (${Object.entries(data.lastPurge.afterData).map(([key, value]) => `${key} ${value}`).join(", ")})`}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>항목</TableHead>
                    <TableHead>기능</TableHead>
                    <TableHead>보유기간</TableHead>
                    <TableHead>처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.retentionPolicy.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.featureId}</TableCell>
                      <TableCell className="text-xs">{row.retention}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.625rem]">{MODE_LABEL[row.mode] ?? row.mode}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {purge.data && (
                <p className="mt-2 text-[0.6875rem] font-medium text-primary">
                  파기 결과 · {Object.entries(purge.data.purged).map(([key, value]) => `${key} ${value}건`).join(" · ")}
                </p>
              )}
            </>
          )}
        </QueryState>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-bold text-foreground">열람·삭제 요구</h2>
        <QueryState
          query={requests}
          empty="접수된 요구가 없습니다."
          skeleton={<SkeletonList count={2} className="h-16 rounded-xl" wrapperClassName="space-y-2" />}
        >
          {(rows) => (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {row.requestType === "DELETE" ? "삭제 요구" : "열람 요구"}
                        {!row.visitorSessionId && (
                          <span className="ml-2 text-[0.6875rem] font-medium text-muted-foreground">식별자 없음</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                        접수 {time(row.createdAt)}
                        {row.handledAt && ` · 처리 ${time(row.handledAt)}`}
                        {row.handlerName && ` · ${row.handlerName}`}
                      </p>
                      {row.detail && <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>}
                      {row.result?.collected && (
                        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                          대상 데이터 · {Object.entries(row.result.collected).map(([key, value]) => `${key} ${value}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill tone={STATUS_TONE[row.status] ?? "neutral"}>
                        {PRIVACY_REQUEST_STATUS_LABEL[row.status] ?? row.status}
                      </StatusPill>
                      {row.status !== "COMPLETED" && row.status !== "REJECTED" && (
                        <>
                          {row.status === "RECEIVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handle.mutate({ requestId: row.id, status: "IN_PROGRESS" })}
                            >
                              처리 시작
                            </Button>
                          )}
                          <ConfirmButton
                            size="sm"
                            variant={row.requestType === "DELETE" ? "destructive" : "default"}
                            title={row.requestType === "DELETE" ? "삭제를 완료 처리할까요?" : "열람 요구를 완료 처리할까요?"}
                            description={
                              row.requestType === "DELETE"
                                ? "해당 방문 세션의 데이터를 참조 데이터까지 연쇄 파기해요. 되돌릴 수 없어요."
                                : "수집 항목 요약을 요구 이력에 기록해요."
                            }
                            confirmLabel="완료 처리"
                            onConfirm={() => handle.mutate({ requestId: row.id, status: "COMPLETED" })}
                          >
                            완료
                          </ConfirmButton>
                          <ConfirmButton
                            size="sm"
                            variant="outline"
                            title="요구를 거절할까요?"
                            reason={{ label: "거절 사유", placeholder: "예: 식별자를 확인할 수 없어 대상 데이터를 특정할 수 없습니다." }}
                            confirmLabel="거절"
                            onConfirm={(note) => handle.mutate({ requestId: row.id, status: "REJECTED", note })}
                          >
                            거절
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Fingerprint className="size-4 text-primary" /> 식별자 재발급 검토
        </h2>
        <p className="mb-3 text-[0.6875rem] text-muted-foreground">
          같은 기기 버킷에서 익명 식별자가 여러 번 발급되면 1인당 한도가 초기화됐을 수 있습니다. 공용 와이파이에서는
          서로 다른 방문객이 한 버킷에 묶일 수 있어 자동 차단이 아니라 담당자 검토 신호로만 씁니다.
        </p>
        <QueryState query={identity} skeleton={<SkeletonList count={2} className="h-10 rounded-lg" wrapperClassName="space-y-2" />}>
          {(data) => (
            <>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <StatCard label="발급" value={data.totals.issuances.toLocaleString()} helper="누적 식별자 발급" icon={Fingerprint} />
                <StatCard label="재발급" value={data.totals.reissues.toLocaleString()} helper="같은 기기 버킷 재발급" icon={AlertTriangle} tone="primary" />
                <StatCard label="기기 버킷" value={data.totals.devices.toLocaleString()} helper="구분된 기기 수" icon={Fingerprint} />
              </div>
              {data.suspects.length === 0 ? (
                <p className="text-xs text-muted-foreground">재발급이 반복된 기기가 없습니다.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>기기</TableHead>
                      <TableHead>발급 횟수</TableHead>
                      <TableHead>쿠폰</TableHead>
                      <TableHead>리워드</TableHead>
                      <TableHead>예약</TableHead>
                      <TableHead>최근 발급</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.suspects.map((row) => (
                      <TableRow key={row.deviceKey}>
                        <TableCell className="font-mono text-xs">{row.deviceKey}</TableCell>
                        <TableCell className="font-semibold">{row.sessionCount}</TableCell>
                        <TableCell>{row.couponIssues}</TableCell>
                        <TableCell>{row.rewardEvents}</TableCell>
                        <TableCell>{row.bookings}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{time(row.lastAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </QueryState>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Camera className="size-4 text-primary" /> 키오스크 카메라·AI 투명성
        </h2>
        <p className="mb-3 text-[0.6875rem] text-muted-foreground">
          연령대 추정으로 큰 글씨 모드를 제안하는 기능(KIOSK-A11Y-01)의 처리 원칙과 효과를 확인하고,
          편향·오탐이 확인되면 여기서 중지해요. 중지해도 방문객은 수동 큰 글씨·음성 안내를 그대로 쓸 수 있어요.
        </p>
        <QueryState query={kioskCamera} skeleton={<SkeletonList count={3} className="h-10 rounded-lg" wrapperClassName="space-y-2" />}>
          {(data) => {
            const estimateResults = {
              counts: data.estimateResults?.counts ?? {},
              recent: data.estimateResults?.recent ?? [],
            };
            return (
              <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <StatusPill tone={data.enabled ? "success" : "muted"}>
                    {data.enabled ? "카메라 제안 사용 중" : "카메라 제안 중지됨"}
                  </StatusPill>
                  {!data.enabled && data.stopReason && (
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">중지 사유 · {data.stopReason}</p>
                  )}
                </div>
                {data.enabled ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Textarea
                      rows={1}
                      value={stopReason}
                      onChange={(event) => setStopReason(event.target.value)}
                      placeholder="중지 사유 (예: 고령층 오탐 확인)"
                      className="sm:w-72"
                    />
                    <ConfirmButton
                      size="sm"
                      variant="destructive"
                      disabled={!stopReason.trim()}
                      title="카메라 제안을 중지할까요?"
                      description="키오스크에서 카메라 동의 요청과 연령대 추정이 즉시 사라지고, 수동 접근성 모드만 남습니다. 사유는 감사 로그에 남습니다."
                      confirmLabel="중지"
                      onConfirm={() => camera.mutate({ enabled: false, stopReason })}
                    >
                      제안 중지
                    </ConfirmButton>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => camera.mutate({ enabled: true })}>
                    제안 사용
                  </Button>
                )}
              </div>

              <ul className="list-disc space-y-1 rounded-xl bg-muted/60 py-3 pr-3 pl-8 text-[0.6875rem] leading-5 text-muted-foreground">
                <li>{data.notice.purpose}</li>
                <li>{data.notice.choice}</li>
                <li>{data.notice.processingLocation}</li>
                <li>{data.notice.retention}</li>
                <li>{data.notice.prohibitedUse}</li>
              </ul>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatCard label="동의 수락률" value={percent(data.rates.consentAcceptRate)} helper={`요청 ${data.counts.CONSENT_SHOWN ?? 0}건`} />
                <StatCard label="추정 실패율" value={percent(data.rates.estimateFailureRate)} helper={`동의 ${data.counts.CONSENT_GRANTED ?? 0}건`} />
                <StatCard label="제안 수락률" value={percent(data.rates.suggestionAcceptRate)} helper={`제안 ${data.counts.SUGGESTED ?? 0}건`} />
                <StatCard label="수동 전환" value={`${data.rates.manualLargeTextCount}건`} helper="카메라 없이 큰 글씨" />
                <StatCard label="안내 화면 도달" value={`${data.rates.taskCompletedCount}건`} helper="이용 흐름당 1건" />
                <StatCard label="모델" value={data.models[0]?.modelVersion ?? "-"} helper={data.models.length > 1 ? `외 ${data.models.length - 1}개` : "단일 버전"} />
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-bold text-foreground">얼굴인식 결과 로그</h3>
                  <span className="text-[0.6875rem] text-muted-foreground">최근 100건 · 익명 범주만 저장</span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <StatCard label="중장년층" value={`${estimateResults.counts.SENIOR ?? 0}건`} helper="큰 글씨 제안 대상" />
                  <StatCard label="그 외" value={`${estimateResults.counts.OTHER ?? 0}건`} helper="제안 없음" />
                  <StatCard label="판단 불가" value={`${estimateResults.counts.UNAVAILABLE ?? 0}건`} helper="카메라·모델 오류" />
                </div>
                {!data.estimateResultLoggingAvailable ? (
                  <p className="text-[0.6875rem] leading-5 text-muted-foreground">
                    현재 연결된 백엔드는 얼굴인식 결과 로그를 아직 지원하지 않아요. 기존 키오스크·카메라 기능은 사용할 수 있고,
                    백엔드에 결과 로그 migration을 적용하면 이곳에 기록돼요.
                  </p>
                ) : estimateResults.recent.length === 0 ? (
                  <p className="text-[0.6875rem] text-muted-foreground">아직 얼굴인식 결과가 없습니다.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>결과</TableHead>
                        <TableHead>모델</TableHead>
                        <TableHead>기록 시각</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estimateResults.recent.slice(0, 10).map((row, index) => (
                        <TableRow key={`${row.createdAt}-${index}`}>
                          <TableCell>
                            <StatusPill tone={row.result === "SENIOR" ? "success" : row.result === "OTHER" ? "neutral" : "warning"}>
                              {row.result === "SENIOR" ? "중장년층" : row.result === "OTHER" ? "그 외" : "판단 불가"}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.modelVersion}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{time(row.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">
                지표는 방문객 세션과 연결하지 않은 건수 집계예요 — 누가 어떤 추정을 받았는지는 조회할 수 없어요. 영상·얼굴 특징값·추정 연령은 저장하지 않아요.
              </p>
              </div>
            );
          }}
        </QueryState>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Radio className="size-4 text-primary" /> 공지·호출 도달 결과
        </h2>
        <QueryState query={deliveries} skeleton={<SkeletonList count={3} className="h-10 rounded-lg" wrapperClassName="space-y-2" />}>
          {(data) => (
            <>
              <p className="mb-3 rounded-xl bg-muted/60 p-3 text-[0.6875rem] leading-5 text-muted-foreground">
                {data.channel.limitation}
                <br />
                공지 {data.channel.announcementPollSeconds}초 · 예약 호출 {data.channel.bookingPollSeconds}초 주기로 갱신돼요.
                예약 호출 {data.bookingCalls.called}건 중 {data.bookingCalls.delivered}건 노출
                {data.bookingCalls.avgLagSeconds !== null && ` · 평균 ${data.bookingCalls.avgLagSeconds}초`}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>공지</TableHead>
                    <TableHead>중요도</TableHead>
                    <TableHead>대상 구역</TableHead>
                    <TableHead>노출 세션</TableHead>
                    <TableHead>최초 노출까지</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.announcements.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-56 truncate font-medium">{row.title}</TableCell>
                      <TableCell>
                        <StatusPill tone={row.severity === "EMERGENCY" ? "danger" : row.severity === "WARNING" ? "warning" : "neutral"}>
                          {row.severity}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.targetAreaIds.length ? `${row.targetAreaIds.length}개 구역` : "전체"}
                      </TableCell>
                      <TableCell className="font-semibold">{row.deliveredSessions}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lag(row.firstDeliveryLagSeconds)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </QueryState>
      </section>
    </div>
  );
}
