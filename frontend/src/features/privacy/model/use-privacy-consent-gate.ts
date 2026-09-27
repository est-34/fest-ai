"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchPrivacyNotice, updateConsents } from "@/features/privacy/api/privacy";
import { useWrite } from "@/shared/lib/use-write";

/**
 * 방문객 진입 전 개인정보 동의 게이트. 철회 불가(필수) 항목을 모두 체크해야 진입 가능하다.
 * 조회에 실패하면 게이트 없이 바로 진입하게 두어 랜딩이 백엔드 장애로 막히지 않게 한다.
 */
export function usePrivacyConsentGate() {
  const router = useRouter();
  const notice = useQuery({ queryKey: ["privacy-notice"], queryFn: fetchPrivacyNotice });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const consent = useWrite((next: Record<string, boolean>) => updateConsents(next));

  const items = notice.data?.items ?? [];
  const requiredItems = items.filter((item) => !item.withdrawable);
  const canEnter = notice.isError || requiredItems.every((item) => checked[item.key]);
  const allChecked = items.length > 0 && items.every((item) => checked[item.key]);

  function toggle(key: string, value: boolean) {
    setChecked((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAll(value: boolean) {
    setChecked(Object.fromEntries(items.map((item) => [item.key, value])));
  }

  function handleEnter() {
    if (notice.isError) {
      router.push("/visitor");
      return;
    }
    const withdrawableUpdates = Object.fromEntries(
      items.filter((item) => item.withdrawable).map((item) => [item.key, checked[item.key] ?? false]),
    );
    if (Object.keys(withdrawableUpdates).length > 0) {
      consent.mutate(withdrawableUpdates, { onSettled: () => router.push("/visitor") });
    } else {
      router.push("/visitor");
    }
  }

  return {
    items,
    requiredItems,
    checked,
    toggle,
    allChecked,
    toggleAll,
    canEnter,
    isLoading: notice.isLoading,
    isError: notice.isError,
    isPending: consent.isPending,
    handleEnter,
  };
}

export type PrivacyConsentGate = ReturnType<typeof usePrivacyConsentGate>;
