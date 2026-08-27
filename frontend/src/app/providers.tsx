"use client";

import { useEffect, useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { Toaster, toast } from "@/shared/ui/toast";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { mutationToast, type MutationToastMeta } from "@/shared/lib/mutation-toast";

/**
 * 관리자 콘솔의 쓰기 동작은 화면이 그대로라 성공했는지 알 수 없어 중복 실행이 잦았다.
 * 화면마다 성공 문구를 넣는 대신 mutation cache에서 한 번에 처리한다.
 * 문구는 useMutation의 meta.success로 넘기고, 알림이 방해가 되는 곳은 meta.silent를 쓴다.
 */
function notify(outcome: "success" | "error", meta: MutationToastMeta | undefined, error?: unknown) {
  const result = mutationToast(outcome, meta, location.pathname, queryErrorMessage(error, "처리하지 못했어요."));
  if (result) toast(result.message, result.tone);
}

const mutationCache = new MutationCache({
  onSuccess: (_data, _variables, _context, mutation) => notify("success", mutation.meta as MutationToastMeta | undefined),
  onError: (error, _variables, _context, mutation) => notify("error", mutation.meta as MutationToastMeta | undefined, error),
});

export function Providers({ children }: { children: React.ReactNode }) {
  const largeText = useAccessibilityStore((state) => state.largeText);
  const highContrast = useAccessibilityStore((state) => state.highContrast);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache,
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    document.documentElement.dataset.largeText = String(largeText);
  }, [largeText]);

  useEffect(() => {
    document.documentElement.dataset.highContrast = String(highContrast);
  }, [highContrast]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

