"use client";

import { Search } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/** 목록 위에 붙는 검색 상자. 관리자 목록 화면이 같은 모양을 쓴다. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  count,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 현재 조건에 걸린 건수 — 검색이 먹었는지 바로 확인할 수 있게 한다. */
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>
      {count !== undefined && <p className="mt-1 text-xs text-muted-foreground">{count}건</p>}
    </div>
  );
}

/** 아직 그리지 않은 항목이 있을 때만 나오는 더 보기 버튼. */
export function ShowMore({ hidden, onShowMore }: { hidden: number; onShowMore: () => void }) {
  if (hidden === 0) return null;
  return (
    <div className="flex justify-center pt-1">
      <Button variant="outline" size="sm" onClick={onShowMore}>
        {hidden}건 더 보기
      </Button>
    </div>
  );
}
