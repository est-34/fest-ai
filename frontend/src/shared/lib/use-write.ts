"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

/** invalidates 항목. 문자열 하나면 `[key]`로, 배열이면 그대로 queryKey가 된다. */
type QueryKeyish = string | readonly unknown[];

/**
 * 쓰기 뮤테이션 + 성공 시 쿼리 무효화.
 *
 * 화면마다 `useQueryClient()` → `const invalidate = () => queryClient.invalidateQueries(...)` →
 * `useMutation({ mutationFn, meta, onSuccess: invalidate })`를 반복하던 것을 한 곳에 둔다.
 * 알림 설정(meta.success/meta.silent)은 providers.tsx의 mutation cache가 읽는다.
 */
export function useWrite<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  {
    success,
    silent,
    invalidates = [],
    onSuccess,
  }: {
    success?: string;
    silent?: boolean;
    invalidates?: readonly QueryKeyish[];
    onSuccess?: (data: TData, variables: TVariables) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    mutationFn,
    meta: success || silent ? { success, silent } : undefined,
    onSuccess: (data, variables) => {
      for (const key of invalidates) {
        queryClient.invalidateQueries({ queryKey: typeof key === "string" ? [key] : key });
      }
      onSuccess?.(data, variables);
    },
  });
}

/**
 * 목록에서 이 행에 대한 쓰기가 진행 중인지.
 *
 * `m.isPending && m.variables?.someId === row.id`를 행마다 손으로 쓰면 키 이름을 틀려도
 * 조용히 지나가서(버튼이 영영 안 잠긴다) 여기서 변수 값 중 일치하는 것이 있는지로 판단한다.
 */
export function isPendingFor(mutation: { isPending: boolean; variables?: unknown }, id: string) {
  if (!mutation.isPending) return false;
  const { variables } = mutation;
  if (typeof variables === "string") return variables === id;
  return typeof variables === "object" && variables !== null && Object.values(variables).includes(id);
}
