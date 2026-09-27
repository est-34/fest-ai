"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import {
  MAP_LOCATION_CATEGORIES,
  categoryLabel,
  createMapLocation,
  deleteMapLocation,
  fetchMapLocations,
  updateMapLocation,
  type MapLocation,
  type MapLocationCategory,
  type MapLocationInput,
} from "@/features/map/api/map-locations";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { SkeletonList } from "@/shared/ui/skeleton";
import { useWrite } from "@/shared/lib/use-write";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

const EMPTY_FORM: MapLocationInput = {
  name: "",
  category: "BOOTH",
  latitude: 37.5266,
  longitude: 126.9338,
  description: "",
  isVisible: true,
};

function LocationForm({ value, onChange }: { value: MapLocationInput; onChange: (value: MapLocationInput) => void }) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-1.5">
        <Label htmlFor="location-name">지점 이름</Label>
        <Input id="location-name" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="예: 친환경 굿즈 부스" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="location-category">분류</Label>
        <select id="location-category" value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value as MapLocationCategory })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30">
          {MAP_LOCATION_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="location-latitude">위도</Label>
          <Input id="location-latitude" type="number" step="0.000001" value={value.latitude} onChange={(event) => onChange({ ...value, latitude: Number(event.target.value) })} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="location-longitude">경도</Label>
          <Input id="location-longitude" type="number" step="0.000001" value={value.longitude} onChange={(event) => onChange({ ...value, longitude: Number(event.target.value) })} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="location-description">방문객 안내</Label>
        <Textarea id="location-description" value={value.description ?? ""} onChange={(event) => onChange({ ...value, description: event.target.value })} placeholder="지도에서 방문객에게 보여줄 설명을 입력하세요." rows={3} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={value.isVisible} onChange={(event) => onChange({ ...value, isVisible: event.target.checked })} className="size-4 accent-primary" />
        방문객 지도에 공개
      </label>
    </div>
  );
}

export function MapLocationAdminPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MapLocation | null>(null);
  const [form, setForm] = useState<MapLocationInput>(EMPTY_FORM);
  const locations = useQuery({
    queryKey: ["admin-map-locations"],
    queryFn: () => fetchMapLocations({ includeHidden: true }),
  });

  const invalidates = ["admin-map-locations"];
  const saveMutation = useWrite(() => (editing ? updateMapLocation(editing.id, form) : createMapLocation(form)), {
    invalidates, onSuccess: () => setDialogOpen(false),
  });
  const deleteMutation = useWrite(deleteMapLocation, { invalidates });
  const visibilityMutation = useWrite(
    (location: MapLocation) => updateMapLocation(location.id, { ...location, isVisible: !location.isVisible }),
    { invalidates },
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(location: MapLocation) {
    setEditing(location);
    setForm({
      name: location.name,
      category: location.category,
      latitude: location.latitude,
      longitude: location.longitude,
      description: location.description,
      isVisible: location.isVisible,
      version: location.version,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) return;
    saveMutation.mutate();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><MapPinned className="size-5 text-primary" /><h2 className="text-base font-bold text-foreground">지도 부스 지점 관리</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">DB에 저장된 좌표를 방문객 카카오맵 마커로 표시해요.</p>
        </div>
        <Button onClick={openCreate}><Plus />지점 추가</Button>
      </div>

      <QueryState
        query={locations}
        className="mt-5"
        empty="등록된 지점이 없어요."
        skeleton={<SkeletonList count={3} className="h-36 rounded-xl" wrapperClassName="mt-5 grid gap-3 space-y-0 md:grid-cols-2 xl:grid-cols-3" />}
      >
        {(rows) => (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((location) => (
              <article key={location.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.625rem] font-bold text-primary">{categoryLabel(location.category)}</span>
                      {!location.isVisible && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-bold text-muted-foreground">비공개</span>}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-bold text-foreground">{location.name}</h3>
                  </div>
                  <MapPinned className="size-5 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{location.description || "등록된 안내 문구가 없어요."}</p>
                <p className="mt-2 font-mono text-[0.625rem] text-muted-foreground">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => visibilityMutation.mutate(location)} aria-label={location.isVisible ? "지도에서 숨기기" : "지도에 공개하기"}>{location.isVisible ? <Eye /> : <EyeOff />}{location.isVisible ? "공개" : "비공개"}</Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(location)} aria-label="지점 수정"><Pencil /></Button>
                  <ConfirmButton variant="destructive" size="icon-sm" title="지점을 삭제할까요?" description={`${location.name} 지점을 지우면 방문객 지도에서도 사라져요.`} confirmLabel="삭제" onConfirm={() => deleteMutation.mutate(location.id)} aria-label="지점 삭제"><Trash2 /></ConfirmButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <Form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{editing ? "부스 지점 수정" : "새 부스 지점 추가"}</DialogTitle><DialogDescription>카카오맵에 표시할 좌표와 방문객 안내 정보를 입력하세요.</DialogDescription></DialogHeader>
            <LocationForm value={form} onChange={setForm} />
            {saveMutation.isError && <p className="mb-3 text-xs font-medium text-destructive">저장하지 못했어요. 백엔드 API 연결 상태를 확인해 주세요.</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>취소</Button><SubmitButton mutation={saveMutation} size="default" pending="저장 중…">저장</SubmitButton></DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
