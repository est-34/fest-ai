import { MapLocationAdminPanel } from "@/features/map/ui/map-location-admin-panel";

export default function AdminMapLocationsPage() {
  return (
    <div className="space-y-5">
      {/* 제목은 상단바가 이미 그린다 — 여기서는 설명만. */}
      <p className="text-sm text-muted-foreground">부스와 시설 좌표를 관리하면 방문객 카카오맵에 바로 반영돼요.</p>
      <MapLocationAdminPanel />
    </div>
  );
}
