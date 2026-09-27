"use client";

import { useState } from "react";

/** 값이 문자열(또는 비어 있을 수 있는 문자열)인 키만 고른다. */
type StringKey<T> = { [K in keyof T]: T[K] extends string | null | undefined ? K : never }[keyof T];

/**
 * 폼 상태와 필드별 setter. 화면마다 반복되던 `setForm({ ...form, x: v })`를 없앤다.
 *
 * - `field("title")`: 문자열 입력에 그대로 펼친다 — `<Input {...field("title")} />`
 * - `set("areaId")`: 값만 받는 곳에 넘긴다 — `<Select onValueChange={set("areaId")} />`
 * - 숫자·nullable처럼 변환이 필요한 필드는 `set("x")(변환값)`으로 직접 쓴다.
 *
 * 갱신은 함수형이라 한 tick에 두 필드를 바꿔도 먼저 쓴 값이 덮이지 않는다.
 */
export function useForm<T extends object>(initial: T | (() => T)) {
  const create = () => (typeof initial === "function" ? (initial as () => T)() : initial);
  const [form, setForm] = useState<T>(create);

  const set =
    <K extends keyof T>(key: K) =>
    (value: T[K]) =>
      setForm((previous) => ({ ...previous, [key]: value }));

  // 문자열 필드로만 제한한다 — 숫자·불리언 필드에 쓰면 문자열이 조용히 들어가므로
  // 그런 필드는 컴파일 단계에서 막고 set("x")(Number(...)) 쪽으로 보낸다.
  const field = <K extends StringKey<T>>(key: K) => ({
    value: (form[key] ?? "") as string,
    onChange: (event: { target: { value: string } }) => set(key)(event.target.value as T[K]),
  });

  return { form, setForm, set, field, reset: () => setForm(create()) };
}
