"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import {
  categoryLabel,
  fetchMapLocations,
  type MapLocation,
} from "@/features/map/api/map-locations";
import { useTranslation } from "@/shared/lib/i18n";

type KakaoLatLng = object;
type KakaoMap = object;
type KakaoMarker = object;

interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  setContent: (content: string) => void;
}

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
        Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
        Marker: new (options: { position: KakaoLatLng; map: KakaoMap; title?: string }) => KakaoMarker;
        InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow;
        event: { addListener: (target: KakaoMarker, type: "click", handler: () => void) => void };
      };
    };
  }
}

let kakaoSdkPromise: Promise<void> | null = null;
let kakaoSdkFailureReported = false;

function getKakaoMapAppKey() {
  return (
    process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
    ""
  ).trim();
}

function loadKakaoSdk(appKey: string) {
  if (window.kakao?.maps) return new Promise<void>((resolve) => window.kakao!.maps.load(resolve));
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-kakao-map-sdk]");
    const script = existingScript ?? document.createElement("script");
    script.addEventListener("load", () => {
      if (!window.kakao?.maps) return reject(new Error("Kakao Maps SDK did not initialize."));
      window.kakao.maps.load(resolve);
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Kakao Maps SDK failed to load.")), { once: true });
    if (!existingScript) {
      script.dataset.kakaoMapSdk = "true";
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
      document.head.appendChild(script);
    }
  });
  return kakaoSdkPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function FestivalMap() {
  const { locale } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing-key" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      const rows = await fetchMapLocations({ locale });
      if (cancelled) return;
      setLocations(rows);
      setSelectedLocation(rows[0] ?? null);
      const appKey = getKakaoMapAppKey();
      if (!appKey) return setStatus("missing-key");

      try {
        await loadKakaoSdk(appKey);
        if (cancelled || !containerRef.current || !window.kakao?.maps || rows.length === 0) return;
        const kakaoMaps = window.kakao.maps;
        const map = new kakaoMaps.Map(containerRef.current, {
          center: new kakaoMaps.LatLng(rows[0].latitude, rows[0].longitude),
          level: 4,
        });
        const infoWindow = new kakaoMaps.InfoWindow({ content: "", removable: true });
        rows.forEach((location) => {
          const marker = new kakaoMaps.Marker({
            map,
            position: new kakaoMaps.LatLng(location.latitude, location.longitude),
            title: location.name,
          });
          kakaoMaps.event.addListener(marker, "click", () => {
            infoWindow.setContent(
              `<div style="min-width:132px;padding:9px 12px;color:#111;font-size:12px;font-weight:700;white-space:nowrap;text-align:center">${escapeHtml(location.name)}<div style="margin-top:3px;color:#86868b;font-size:10px;font-weight:600">${escapeHtml(categoryLabel(location.category))}</div></div>`,
            );
            infoWindow.open(map, marker);
            setSelectedLocation(location);
          });
        });
        setStatus("ready");
      } catch (error) {
        if (!kakaoSdkFailureReported) {
          console.info("Kakao Maps SDK is unavailable. Showing festival locations instead.", error);
          kakaoSdkFailureReported = true;
        }
        if (!cancelled) setStatus("error");
      }
    }
    initializeMap();
    return () => { cancelled = true; };
  }, [locale]);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-64 bg-muted" aria-label="축제 부스와 시설 지도">
        <div ref={containerRef} className="absolute inset-0" />
        {status === "loading" && <div className="absolute inset-0 grid place-items-center bg-muted text-xs font-semibold text-muted-foreground">카카오 지도를 불러오는 중이에요.</div>}
        {(status === "missing-key" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted px-6 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-background text-primary"><AlertCircle className="size-5" /></span>
            <div>
              <p className="text-sm font-bold text-foreground">{status === "missing-key" ? "카카오 지도 키 설정이 필요해요" : "카카오 지도를 불러오지 못했어요"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {status === "missing-key"
                  ? "실행 중인 Frontend/.env.local 또는 Frontend/.env에 NEXT_PUBLIC_KAKAO_MAP_APP_KEY를 설정하고 개발 서버를 다시 시작해 주세요."
                  : "카카오 JavaScript 키의 도메인 등록 상태를 확인해 주세요. 등록된 부스 목록은 아래에서 확인할 수 있습니다."}
              </p>
            </div>
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[0.625rem] font-bold text-foreground">
          {status === "ready" ? <CheckCircle2 className="size-3 text-emerald-600" /> : <MapPin className="size-3" />}
          {status === "ready" ? "Kakao Map 연결됨" : `${locations.length}개 지점 등록`}
        </span>
      </div>

      {selectedLocation && (
        <div className="flex items-start gap-3 border-t border-border p-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><MapPin className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-foreground">{selectedLocation.name}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-bold text-muted-foreground">{categoryLabel(selectedLocation.category)}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedLocation.description ?? "축제에 등록된 부스 지점이에요."}</p>
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2 [scrollbar-width:none]">
          {locations.map((location) => (
            <button key={location.id} type="button" onClick={() => setSelectedLocation(location)} className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
              {location.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
