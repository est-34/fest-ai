"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Bus, Copy, Plus, SmartphoneNfc, Trash2 } from "lucide-react";
import {
  cloneFestival,
  createFacility,
  deleteFacility,
  fetchCurrentFestival,
  fetchFacilities,
  FESTIVAL_STATUSES,
  updateFacility,
  updateFestival,
  type AdminFestival,
  type CloneFestivalInput,
  type NewFacility,
  type TransportOption,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
} from "@/features/festival-admin";
import { fetchAreas } from "@/entities/area";
import { useForm } from "@/shared/lib/use-form";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { datetimeLocal, toIso } from "@/shared/lib/utils";
import { ALL_MENUS_ON, VISITOR_MENU_ITEMS } from "@/features/visitor-menu-settings";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { Textarea } from "@/shared/ui/textarea";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { ErrorState, QueryState, queryErrorMessage } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";

const FACILITY_TYPES = ["RESTROOM", "PARKING", "FIRST_AID", "INFO", "NURSING_ROOM", "STORAGE"];

const FACILITY_LABEL: Record<string, string> = {
  RESTROOM: "화장실", PARKING: "주차장", FIRST_AID: "구급실", INFO: "안내소", NURSING_ROOM: "수유실", STORAGE: "물품보관소",
};

export default function FestivalSettingsPage() {
  const festival = useQuery({ queryKey: ["current-festival"], queryFn: fetchCurrentFestival });

  if (festival.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (festival.isError || !festival.data) {
    return <ErrorState message={queryErrorMessage(festival.error)} onRetry={() => festival.refetch()} />;
  }
  // 서버 값이 도착한 뒤에만 폼을 만든다 — 편집 중에 배경 갱신이 입력을 덮어쓰지 않도록.
  return <FestivalSettings festival={festival.data} />;
}

function FestivalSettings({ festival: data }: { festival: AdminFestival }) {
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: fetchAreas });
  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: fetchFacilities });

  const { form, set: formSet, field: formField } = useForm({
    name: data.name,
    description: data.description ?? "",
    status: data.status,
    startsAt: datetimeLocal(data.startsAt),
    endsAt: datetimeLocal(data.endsAt),
  });
  const { form: clone, field: cloneField } = useForm<CloneFestivalInput>({ code: "", name: "", startsAt: "", endsAt: "" });
  const { form: facility, set: facilitySet, field: facilityField, reset: resetFacility } = useForm<NewFacility>({ areaId: "", name: "", facilityType: "RESTROOM", status: "ACTIVE" });

  const festivalInvalidates = ["current-festival", "public-festival", "festival-info", "transport", "festival-languages", "visitor-menus"];
  const save = useWrite(updateFestival, { success: "축제 정보를 저장했어요.", invalidates: festivalInvalidates });
  const duplicate = useWrite(cloneFestival, { success: "복제했어요. 새 축제는 축제 코드를 바꿔 접속하세요." });
  const addFacility = useWrite(createFacility, {
    success: "편의시설을 추가했어요.", invalidates: ["admin-facilities"], onSuccess: resetFacility,
  });
  const toggleFacility = useWrite(updateFacility, { success: "시설 운영 상태를 바꿨어요.", invalidates: ["admin-facilities"] });
  const removeFacility = useWrite(deleteFacility, { success: "편의시설을 삭제했어요.", invalidates: ["admin-facilities"] });

  const menus = { ...ALL_MENUS_ON, ...(data.visitorMenus ?? {}) };
  const saveMenus = useWrite(updateFestival, {
    success: "방문객 메뉴 노출을 저장했어요.", invalidates: festivalInvalidates,
  });

  const [transport, setTransport] = useState<TransportOption[]>(data.transport ?? []);
  const saveTransport = useWrite(updateFestival, { success: "교통 안내를 저장했어요.", invalidates: festivalInvalidates });
  const patchTransport = (index: number, values: Partial<TransportOption>) =>
    setTransport(transport.map((row, position) => (position === index ? { ...row, ...values } : row)));

  const areaName = (id: string) => areas.data?.find((area) => area.id === id)?.name ?? "구역";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        축제 기본 정보와 공개 상태, 편의시설을 관리해요. 다음 회차 축제는 현재 기준정보를 복제해 시작할 수 있어요.
      </p>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <SmartphoneNfc className="size-4 text-primary" /> 방문객 메뉴 노출
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          끄면 모든 방문객의 홈 화면·하단 메뉴에서 숨겨져요. 페이지 주소로는 계속 접근할 수 있어요.
        </p>
        <div className="mt-3 divide-y divide-border">
          {VISITOR_MENU_ITEMS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={menus[key]}
                disabled={saveMenus.isPending}
                onCheckedChange={(checked) =>
                  saveMenus.mutate({ version: data.version, visitorMenus: { ...menus, [key]: checked } })
                }
              />
            </div>
          ))}
        </div>
        <ErrorText error={saveMenus.error} className="mt-2" />
      </section>

      {/* 교통 안내는 프론트 상수에 박혀 있어서 운영자가 고칠 수 없었고, 다른 축제를 올려도
          여의도 데모 데이터가 그대로 나왔다. */}
      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Bus className="size-4 text-primary" /> 교통 안내
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          방문객 지도 화면의 오시는 길에 이 순서대로 나와요.
        </p>
        <div className="mt-3 space-y-2">
          {transport.map((option, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr_6rem_auto]">
              <SelectField
                value={option.mode}
                onValueChange={(mode) => patchTransport(index, { mode })}
                options={TRANSPORT_MODES}
                aria-label={`${index + 1}번 교통편 수단`}
              />
              <Input
                value={option.label}
                onChange={(event) => patchTransport(index, { label: event.target.value })}
                placeholder="예: 5호선 여의나루역 2번 출구"
                aria-label={`${index + 1}번 교통편 이름`}
              />
              <Input
                value={option.detail}
                onChange={(event) => patchTransport(index, { detail: event.target.value })}
                placeholder="예: 도보 5분, 엘리베이터 이용 가능"
                aria-label={`${index + 1}번 교통편 설명`}
              />
              <SelectField
                value={option.status}
                onValueChange={(status) => patchTransport(index, { status })}
                options={TRANSPORT_STATUSES}
                aria-label={`${index + 1}번 교통편 상태`}
              />
              <Button type="button" size="sm" variant="outline" aria-label={`${index + 1}번 교통편 삭제`} onClick={() => setTransport(transport.filter((_, position) => position !== index))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" size="sm" variant="outline" className="mr-auto" onClick={() => setTransport([...transport, { mode: "지하철", label: "", detail: "", status: "원활" }])}>
              <Plus className="size-3.5" /> 교통편 추가
            </Button>
            <ErrorText error={saveTransport.error} />
            <SubmitButton
              type="button"
              mutation={saveTransport}
              pending="저장 중..."
              disabled={transport.some((option) => !option.label.trim())}
              onClick={() => saveTransport.mutate({ version: data.version, transport })}
            >
              교통 안내 저장
            </SubmitButton>
          </div>
        </div>
      </section>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Building2 className="size-4 text-primary" /> 축제 정보
          <Badge variant="outline" className="ml-1 text-[0.625rem]">{data.code}</Badge>
        </h2>
        <Form
          className="mt-3 grid gap-3 sm:grid-cols-4"
          onSubmit={() =>
            save.mutate({
              name: form.name,
              description: form.description || null,
              status: form.status,
              startsAt: toIso(form.startsAt),
              endsAt: toIso(form.endsAt),
              version: data.version,
            })
          }
        >
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="festival-name">축제명</Label>
            <Input id="festival-name" {...formField("name")} required />
          </div>
          <div className="space-y-1">
            <Label>공개 상태</Label>
            <SelectField value={form.status} onValueChange={formSet("status")} options={FESTIVAL_STATUSES} aria-label="공개 상태" />
          </div>
          <div className="space-y-1">
            <Label>지원 언어</Label>
            <p className="flex flex-wrap gap-1 pt-1.5">
              {data.supportedLanguages.map((language) => <Badge key={language} variant="outline" className="text-[0.625rem]">{language}</Badge>)}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="festival-starts">시작</Label>
            <Input id="festival-starts" type="datetime-local" {...formField("startsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="festival-ends">종료</Label>
            <Input id="festival-ends" type="datetime-local" {...formField("endsAt")} required />
          </div>
          <div className="space-y-1 sm:col-span-4">
            <Label htmlFor="festival-description">소개</Label>
            <Textarea id="festival-description" rows={2} {...formField("description")} />
          </div>
          <div className="sm:col-span-4 flex items-center justify-end gap-3">
            <SubmitButton mutation={save} pending="저장 중...">저장</SubmitButton>
          </div>
        </Form>
      </section>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Copy className="size-4 text-primary" /> 다음 회차로 복제</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">구역·시설·프로그램 기준정보를 그대로 복제한 새 축제를 만듭니다.</p>
        <Form
          className="mt-3 grid gap-3 sm:grid-cols-4"
          onSubmit={() => duplicate.mutate({ ...clone, startsAt: toIso(clone.startsAt), endsAt: toIso(clone.endsAt) })}
        >
          <div className="space-y-1">
            <Label htmlFor="clone-code">새 축제 코드</Label>
            <Input id="clone-code" {...cloneField("code")} required placeholder="EST35-2027" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clone-name">새 축제명</Label>
            <Input id="clone-name" {...cloneField("name")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clone-starts">시작</Label>
            <Input id="clone-starts" type="datetime-local" {...cloneField("startsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="clone-ends">종료</Label>
            <Input id="clone-ends" type="datetime-local" {...cloneField("endsAt")} required />
          </div>
          <div className="sm:col-span-4 flex items-center justify-end gap-3">
            <SubmitButton mutation={duplicate} pending="복제 중...">복제</SubmitButton>
          </div>
        </Form>
      </section>

      <section className="surface-card rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground">편의시설</h2>
        <Form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={() => addFacility.mutate(facility)}>
          <SelectField
            value={facility.areaId}
            onValueChange={facilitySet("areaId")}
            options={(areas.data ?? []).map((area) => ({ value: area.id, label: area.name }))}
            placeholder="구역"
            aria-label="구역"
          />
          <Input placeholder="시설명" {...facilityField("name")} required />
          <SelectField
            value={facility.facilityType}
            onValueChange={facilitySet("facilityType")}
            options={FACILITY_TYPES.map((type) => ({ value: type, label: FACILITY_LABEL[type] }))}
            aria-label="시설 유형"
          />
          <SubmitButton mutation={addFacility} disabled={!facility.areaId}>시설 추가</SubmitButton>
        </Form>

        <div className="mt-3 space-y-2">
          <QueryState query={facilities} empty="등록된 편의시설이 없습니다." skeleton={<Skeleton className="h-20 w-full rounded-xl" />}>
            {(rows) => rows.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">{FACILITY_LABEL[item.facilityType] ?? item.facilityType} · {areaName(item.areaId)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPendingFor(toggleFacility, item.id)}
                    onClick={() => toggleFacility.mutate({ id: item.id, version: item.version, status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                  >
                    {item.status === "ACTIVE" ? "운영 종료" : "운영 시작"}
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="outline"
                    aria-label="시설 삭제"
                    disabled={isPendingFor(removeFacility, item.id)}
                    title="편의시설을 삭제할까요?"
                    description={`"${item.name}"이(가) 방문객 지도와 안내에서 사라집니다.`}
                    confirmLabel="삭제"
                    onConfirm={() => removeFacility.mutate(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </QueryState>
        </div>
      </section>
    </div>
  );
}
