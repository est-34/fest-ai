"use client";

import { useEffect, useState } from "react";

// 서버 응답이 그대로여도 시간이 지나면 화면에서 사라져야 하는 것들(종료 시각이 지난 공지 등)을
// 위해 일정 주기로 현재 시각을 다시 흘려보낸다. 리렌더를 최소화하려고 간격은 호출부가 정한다.
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
